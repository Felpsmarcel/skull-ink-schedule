-- REVIEW ONLY. NOT APPLIED. Additive. Mirroring confirmed receipts into GHL Invoices.
-- One invoice per immutable project; each manual payment = installment only (integer cents).
-- Apply only after explicit approval. No backfill of old payments.

-- 1) Confirmation state (existing rows stay 'informado'; nothing is enqueued retroactively)
ALTER TABLE public.movimentacoes
  ADD COLUMN IF NOT EXISTS confirmacao_status text NOT NULL DEFAULT 'informado'
    CHECK (confirmacao_status IN ('informado','confirmado','rejeitado')),
  ADD COLUMN IF NOT EXISTS confirmado_por uuid,
  ADD COLUMN IF NOT EXISTS confirmado_em timestamptz;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS confirmacao_status text NOT NULL DEFAULT 'informado'
    CHECK (confirmacao_status IN ('informado','confirmado','rejeitado')),
  ADD COLUMN IF NOT EXISTS confirmado_por uuid,
  ADD COLUMN IF NOT EXISTS confirmado_em timestamptz;

-- 2) Canonical receipt ledger
CREATE TABLE public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  payload_hash text NOT NULL,
  location_id text NOT NULL CHECK (location_id = '9iqrKUVPDddINb9S4Iwd'),
  project_id uuid NOT NULL REFERENCES public.tattoo_projects(id),
  ghl_contact_id text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  paid_on date NOT NULL,
  method text NOT NULL,
  confirmed_by uuid NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now()
);
-- Explicit source map: one source row maps to exactly one receipt; payments+movimentacoes for the
-- SAME event are mapped to one receipt only via this table (never summed independently).
CREATE TABLE public.payment_receipt_sources (
  receipt_id uuid NOT NULL REFERENCES public.payment_receipts(id),
  source text NOT NULL CHECK (source IN ('movimentacao','payment','booking_deposit')),
  source_id uuid NOT NULL,
  PRIMARY KEY (source, source_id)
);

-- 3) Invoice link: one per (location, project)
CREATE TABLE public.project_invoice_links (
  location_id text NOT NULL CHECK (location_id = '9iqrKUVPDddINb9S4Iwd'),
  project_id uuid NOT NULL REFERENCES public.tattoo_projects(id),
  ghl_invoice_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, project_id)
);

-- 4) Outbox with lease/fencing and in-flight markers
CREATE TABLE public.payment_mirror_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL UNIQUE REFERENCES public.payment_receipts(id),
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','fatura_a_conciliar','pagamento_a_conciliar','revisao','concluido')),
  in_flight text CHECK (in_flight IN ('create','record')),
  reason text,
  attempts integer NOT NULL DEFAULT 0,
  lease_token uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ghl_transaction_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5) Refund/correction events (review only, never auto-emitted)
CREATE TABLE public.payment_receipt_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.payment_receipts(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  refunded_on date NOT NULL,
  state text NOT NULL DEFAULT 'revisao' CHECK (state IN ('revisao','aprovado','rejeitado')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Grants: admin-only via RLS; no anon.
GRANT SELECT ON public.payment_receipts, public.payment_receipt_sources, public.project_invoice_links,
  public.payment_mirror_outbox, public.payment_receipt_refunds TO authenticated;
GRANT ALL ON public.payment_receipts, public.payment_receipt_sources, public.project_invoice_links,
  public.payment_mirror_outbox, public.payment_receipt_refunds TO service_role;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipt_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invoice_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_mirror_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipt_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.payment_receipts FOR SELECT TO authenticated USING (public.current_user_role() = 'admin');
CREATE POLICY admin_read ON public.payment_receipt_sources FOR SELECT TO authenticated USING (public.current_user_role() = 'admin');
CREATE POLICY admin_read ON public.project_invoice_links FOR SELECT TO authenticated USING (public.current_user_role() = 'admin');
CREATE POLICY admin_read ON public.payment_mirror_outbox FOR SELECT TO authenticated USING (public.current_user_role() = 'admin');
CREATE POLICY admin_read ON public.payment_receipt_refunds FOR SELECT TO authenticated USING (public.current_user_role() = 'admin');

-- 6) Atomic confirm + enqueue. Caller identity from auth.uid(); never from request body.
CREATE OR REPLACE FUNCTION public.confirm_receipt(
  p_source text, p_source_id uuid, p_project_id uuid, p_idempotency_key text, p_payload_hash text,
  p_amount_cents integer, p_paid_on date, p_method text, p_ghl_contact_id text,
  p_same_event_source text DEFAULT NULL, p_same_event_source_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_existing record; v_receipt uuid; v_proj record;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT id, ghl_contact_id INTO v_proj FROM public.tattoo_projects WHERE id = p_project_id FOR SHARE;
  IF NOT FOUND OR v_proj.ghl_contact_id IS DISTINCT FROM p_ghl_contact_id THEN
    RAISE EXCEPTION 'projeto_divergente';
  END IF;
  IF p_source = 'movimentacao' THEN
    PERFORM 1 FROM public.movimentacoes WHERE id = p_source_id AND deleted_at IS NULL
      AND tipo_movimento <> 'estorno' AND (project_id IS NULL OR project_id = p_project_id) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'fonte_invalida'; END IF;
    UPDATE public.movimentacoes SET confirmacao_status='confirmado', confirmado_por=auth.uid(), confirmado_em=now() WHERE id=p_source_id;
  ELSIF p_source IN ('payment','booking_deposit') THEN
    PERFORM 1 FROM public.payments WHERE id = p_source_id AND status = 'paid' AND type <> 'refund' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'fonte_invalida'; END IF;
    UPDATE public.payments SET confirmacao_status='confirmado', confirmado_por=auth.uid(), confirmado_em=now() WHERE id=p_source_id;
  ELSE RAISE EXCEPTION 'fonte_invalida'; END IF;

  SELECT id, payload_hash INTO v_existing FROM public.payment_receipts WHERE idempotency_key = p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.payload_hash <> p_payload_hash THEN RAISE EXCEPTION 'conflito_idempotencia'; END IF;
    RETURN v_existing.id; -- repeated confirmation: same receipt, no new send
  END IF;
  INSERT INTO public.payment_receipts(idempotency_key, payload_hash, location_id, project_id, ghl_contact_id,
    amount_cents, paid_on, method, confirmed_by)
  VALUES (p_idempotency_key, p_payload_hash, '9iqrKUVPDddINb9S4Iwd', p_project_id, p_ghl_contact_id,
    p_amount_cents, p_paid_on, p_method, auth.uid()) RETURNING id INTO v_receipt;
  INSERT INTO public.payment_receipt_sources VALUES (v_receipt, p_source, p_source_id);
  IF p_same_event_source IS NOT NULL THEN
    INSERT INTO public.payment_receipt_sources VALUES (v_receipt, p_same_event_source, p_same_event_source_id);
  END IF;
  INSERT INTO public.payment_mirror_outbox(receipt_id) VALUES (v_receipt);
  RETURN v_receipt;
END $$;
REVOKE ALL ON FUNCTION public.confirm_receipt FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_receipt TO authenticated;

-- 7) Worker claim with lease + per-project lock (service_role only)
CREATE OR REPLACE FUNCTION public.claim_payment_mirror(p_limit integer, p_lease_seconds integer)
RETURNS SETOF public.payment_mirror_outbox LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.payment_mirror_outbox o SET lease_token = gen_random_uuid(),
    lease_until = now() + make_interval(secs => p_lease_seconds), attempts = attempts + 1, updated_at = now()
  WHERE o.id IN (
    SELECT o2.id FROM public.payment_mirror_outbox o2
    JOIN public.payment_receipts r ON r.id = o2.receipt_id
    WHERE o2.state IN ('pending','fatura_a_conciliar','pagamento_a_conciliar')
      AND o2.next_attempt_at <= now() AND (o2.lease_until IS NULL OR o2.lease_until < now())
      AND NOT EXISTS (SELECT 1 FROM public.payment_mirror_outbox o3 JOIN public.payment_receipts r3 ON r3.id=o3.receipt_id
                      WHERE r3.project_id = r.project_id AND o3.id <> o2.id AND o3.lease_until > now())
    ORDER BY o2.created_at LIMIT p_limit FOR UPDATE SKIP LOCKED)
  RETURNING o.*;
$$;
REVOKE ALL ON FUNCTION public.claim_payment_mirror FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_payment_mirror TO service_role;
-- Fenced writes: every state update must include `WHERE id = $1 AND lease_token = $2 AND lease_until > now()`.
