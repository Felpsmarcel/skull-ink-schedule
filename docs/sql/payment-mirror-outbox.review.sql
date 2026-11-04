-- REVIEW ONLY. NOT APPLIED. Additive. Mirroring confirmed receipts into GHL Invoices.
-- One invoice per immutable project; each manual payment = installment only (integer cents).
-- Every value (amount, date, method, contact, project) is DERIVED from the source tables here;
-- nothing financial is accepted from the caller. Idempotency key and payload hash are computed here.
-- No backfill: existing rows stay 'informado' and nothing is enqueued retroactively.
-- Tested locally in PGlite by tests/unit/payment-mirror-sql.test.ts. Apply only after explicit approval.

-- 1) Confirmation state (separate from payments.status, which is never modified here)
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
-- Source map. `source` is CANONICAL ('payment' covers the booking_deposit alias of the same payments row),
-- so one payments.id can never map to two receipts. `alias` keeps how it was confirmed.
CREATE TABLE public.payment_receipt_sources (
  receipt_id uuid NOT NULL REFERENCES public.payment_receipts(id),
  source text NOT NULL CHECK (source IN ('movimentacao','payment')),
  source_id uuid NOT NULL,
  alias text NOT NULL CHECK (alias IN ('movimentacao','payment','booking_deposit')),
  PRIMARY KEY (source, source_id)
);

-- 3) Invoice link: real uniqueness, one per (location, project) and one project per invoice
CREATE TABLE public.project_invoice_links (
  location_id text NOT NULL CHECK (location_id = '9iqrKUVPDddINb9S4Iwd'),
  project_id uuid NOT NULL REFERENCES public.tattoo_projects(id),
  ghl_invoice_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, project_id)
);

-- 4) Outbox + per-project lock
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
CREATE TABLE public.payment_mirror_project_locks (
  project_id uuid PRIMARY KEY,
  outbox_id uuid NOT NULL,
  lease_token uuid NOT NULL,
  lease_until timestamptz NOT NULL
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

-- Cumulative refund cap, enforced for every insert/update path (locks the receipt row).
CREATE OR REPLACE FUNCTION public.payment_refund_cap_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_orig integer; v_sum integer;
BEGIN
  SELECT amount_cents INTO v_orig FROM public.payment_receipts WHERE id = NEW.receipt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'recibo_inexistente'; END IF;
  SELECT coalesce(sum(amount_cents),0) INTO v_sum FROM public.payment_receipt_refunds
   WHERE receipt_id = NEW.receipt_id AND state <> 'rejeitado' AND id <> NEW.id;
  IF NEW.state <> 'rejeitado' AND v_sum + NEW.amount_cents > v_orig THEN
    RAISE EXCEPTION 'estorno_excede_original';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_refund_cap BEFORE INSERT OR UPDATE ON public.payment_receipt_refunds
  FOR EACH ROW EXECUTE FUNCTION public.payment_refund_cap_trg();

-- Grants: admin-only read via RLS; writes only through SECURITY DEFINER functions.
GRANT SELECT ON public.payment_receipts, public.payment_receipt_sources, public.project_invoice_links,
  public.payment_mirror_outbox, public.payment_receipt_refunds TO authenticated;
GRANT ALL ON public.payment_receipts, public.payment_receipt_sources, public.project_invoice_links,
  public.payment_mirror_outbox, public.payment_receipt_refunds, public.payment_mirror_project_locks TO service_role;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipt_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invoice_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_mirror_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipt_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_mirror_project_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.payment_receipts FOR SELECT TO authenticated USING (public.current_user_role() = 'admin');
CREATE POLICY admin_read ON public.payment_receipt_sources FOR SELECT TO authenticated USING (public.current_user_role() = 'admin');
CREATE POLICY admin_read ON public.project_invoice_links FOR SELECT TO authenticated USING (public.current_user_role() = 'admin');
CREATE POLICY admin_read ON public.payment_mirror_outbox FOR SELECT TO authenticated USING (public.current_user_role() = 'admin');
CREATE POLICY admin_read ON public.payment_receipt_refunds FOR SELECT TO authenticated USING (public.current_user_role() = 'admin');

-- 6) Source loader: derives everything from the tables. Internal (no EXECUTE for clients).
CREATE OR REPLACE FUNCTION public.payment_mirror_load_source(p_alias text, p_source_id uuid)
RETURNS TABLE(canon text, project_id uuid, ghl_contact_id text, amount_cents integer, paid_on date, method text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amount numeric;
BEGIN
  IF p_alias = 'movimentacao' THEN
    SELECT 'movimentacao', m.project_id, m.ghl_contact_id,
           coalesce(m.total, m.valor_cartao + m.valor_dinheiro + m.valor_sumup + m.valor_transferencia),
           m.data_pagamento, coalesce(m.forma_pagamento::text, 'other')
      INTO canon, project_id, ghl_contact_id, v_amount, paid_on, method
      FROM public.movimentacoes m
     WHERE m.id = p_source_id AND m.deleted_at IS NULL AND m.tipo_movimento <> 'estorno'
     FOR UPDATE OF m;
  ELSIF p_alias IN ('payment','booking_deposit') THEN
    SELECT 'payment', a.project_id, c.ghl_contact_id, p.amount_eur, p.paid_at::date, p.method::text
      INTO canon, project_id, ghl_contact_id, v_amount, paid_on, method
      FROM public.payments p
      JOIN public.contacts c ON c.id = p.contact_id
      LEFT JOIN public.appointments a ON a.id = p.appointment_id
     WHERE p.id = p_source_id AND p.status = 'paid' AND p.type <> 'refund'
       AND (p_alias <> 'booking_deposit' OR p.type = 'deposit')
     FOR UPDATE OF p;
  ELSE
    RAISE EXCEPTION 'fonte_invalida';
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'fonte_invalida'; END IF;
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount * 100 <> round(v_amount * 100) THEN RAISE EXCEPTION 'valor_invalido'; END IF;
  IF paid_on IS NULL THEN RAISE EXCEPTION 'data_ausente'; END IF;
  IF project_id IS NULL THEN RAISE EXCEPTION 'projeto_ausente'; END IF;
  IF ghl_contact_id IS NULL THEN RAISE EXCEPTION 'contato_ausente'; END IF;
  amount_cents := (v_amount * 100)::integer;
  RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.payment_mirror_load_source(text, uuid) FROM PUBLIC, anon, authenticated;

-- 7) Atomic confirm + enqueue. Actor = auth.uid(); admin only. Optional same-event alias for the
--    case where payments and movimentacoes recorded the SAME event (verified equal, then mapped once).
CREATE OR REPLACE FUNCTION public.confirm_receipt(
  p_source text, p_source_id uuid, p_expected_project_id uuid DEFAULT NULL,
  p_same_event_source text DEFAULT NULL, p_same_event_source_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; o record; v_ocanon text; v_proj_contact text; v_key text; v_hash text; v_receipt uuid; v_existing record; v_mapped uuid;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO s FROM public.payment_mirror_load_source(p_source, p_source_id);
  IF p_expected_project_id IS NOT NULL AND p_expected_project_id <> s.project_id THEN RAISE EXCEPTION 'projeto_divergente'; END IF;
  SELECT ghl_contact_id INTO v_proj_contact FROM public.tattoo_projects WHERE id = s.project_id FOR SHARE;
  IF NOT FOUND OR v_proj_contact IS DISTINCT FROM s.ghl_contact_id THEN RAISE EXCEPTION 'contato_divergente'; END IF;

  IF p_same_event_source IS NOT NULL THEN
    SELECT * INTO o FROM public.payment_mirror_load_source(p_same_event_source, p_same_event_source_id);
    v_ocanon := o.canon;
    IF o.canon = s.canon AND p_same_event_source_id = p_source_id THEN RAISE EXCEPTION 'mesma_fonte'; END IF;
    IF (o.project_id, o.ghl_contact_id, o.amount_cents, o.paid_on) IS DISTINCT FROM (s.project_id, s.ghl_contact_id, s.amount_cents, s.paid_on)
      THEN RAISE EXCEPTION 'evento_divergente'; END IF;
  END IF;

  -- Already mapped? (covers payment vs booking_deposit alias of the same row)
  SELECT receipt_id INTO v_mapped FROM public.payment_receipt_sources WHERE source = s.canon AND source_id = p_source_id;
  IF FOUND THEN
    IF p_same_event_source IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.payment_receipt_sources WHERE receipt_id = v_mapped AND source = v_ocanon AND source_id = p_same_event_source_id)
      THEN RAISE EXCEPTION 'conflito_mapeamento'; END IF;
    RETURN v_mapped; -- repeated confirmation: same receipt, nothing new enqueued
  END IF;
  IF p_same_event_source IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.payment_receipt_sources WHERE source = v_ocanon AND source_id = p_same_event_source_id)
    THEN RAISE EXCEPTION 'conflito_mapeamento'; END IF;

  v_key := s.canon || ':' || p_source_id::text;
  v_hash := md5(concat_ws('|', s.project_id, s.ghl_contact_id, s.amount_cents, s.paid_on, s.method));
  SELECT id, payload_hash INTO v_existing FROM public.payment_receipts WHERE idempotency_key = v_key FOR UPDATE;
  IF FOUND THEN RAISE EXCEPTION 'conflito_idempotencia'; END IF; -- key without mapping is inconsistent

  INSERT INTO public.payment_receipts(idempotency_key, payload_hash, location_id, project_id, ghl_contact_id,
    amount_cents, paid_on, method, confirmed_by)
  VALUES (v_key, v_hash, '9iqrKUVPDddINb9S4Iwd', s.project_id, s.ghl_contact_id, s.amount_cents, s.paid_on, s.method, auth.uid())
  RETURNING id INTO v_receipt;
  INSERT INTO public.payment_receipt_sources VALUES (v_receipt, s.canon, p_source_id, p_source);
  IF p_same_event_source IS NOT NULL THEN
    INSERT INTO public.payment_receipt_sources VALUES (v_receipt, v_ocanon, p_same_event_source_id, p_same_event_source);
  END IF;

  -- Mark confirmation only after the receipt is mapped (never touches payments.status)
  UPDATE public.movimentacoes SET confirmacao_status='confirmado', confirmado_por=auth.uid(), confirmado_em=now()
   WHERE id IN (SELECT source_id FROM public.payment_receipt_sources WHERE receipt_id = v_receipt AND source='movimentacao');
  UPDATE public.payments SET confirmacao_status='confirmado', confirmado_por=auth.uid(), confirmado_em=now()
   WHERE id IN (SELECT source_id FROM public.payment_receipt_sources WHERE receipt_id = v_receipt AND source='payment');

  INSERT INTO public.payment_mirror_outbox(receipt_id) VALUES (v_receipt);
  RETURN v_receipt;
END $$;
REVOKE ALL ON FUNCTION public.confirm_receipt(text, uuid, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_receipt(text, uuid, uuid, text, uuid) TO authenticated;

-- 8) Refund request (admin) — cap enforced by trigger
CREATE OR REPLACE FUNCTION public.request_receipt_refund(p_receipt uuid, p_amount_cents integer, p_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.payment_receipt_refunds(receipt_id, amount_cents, refunded_on, created_by)
  VALUES (p_receipt, p_amount_cents, p_on, auth.uid()) RETURNING id INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.request_receipt_refund(uuid, integer, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_receipt_refund(uuid, integer, date) TO authenticated;

-- 9) Worker claim (service_role only): recovers expired in-flight as a_conciliar, then leases at most
--    ONE job per project via the project lock table (blocks concurrent claimers on the same project).
CREATE OR REPLACE FUNCTION public.claim_payment_mirror(p_limit integer, p_lease_seconds integer)
RETURNS SETOF public.payment_mirror_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; v_token uuid; v_got integer := 0; v_row public.payment_mirror_outbox;
BEGIN
  UPDATE public.payment_mirror_outbox
     SET state = CASE in_flight WHEN 'create' THEN 'fatura_a_conciliar' ELSE 'pagamento_a_conciliar' END,
         reason = 'in_flight_expirado', in_flight = NULL, lease_token = NULL, lease_until = NULL, updated_at = now()
   WHERE in_flight IS NOT NULL AND lease_until < now();
  DELETE FROM public.payment_mirror_project_locks WHERE lease_until < now();

  FOR c IN
    SELECT o.id, r.project_id FROM public.payment_mirror_outbox o
      JOIN public.payment_receipts r ON r.id = o.receipt_id
     WHERE o.state IN ('pending','fatura_a_conciliar','pagamento_a_conciliar')
       AND o.in_flight IS NULL AND o.next_attempt_at <= now()
       AND (o.lease_until IS NULL OR o.lease_until < now())
     ORDER BY o.created_at
     FOR UPDATE OF o SKIP LOCKED
  LOOP
    EXIT WHEN v_got >= p_limit;
    v_token := gen_random_uuid();
    INSERT INTO public.payment_mirror_project_locks(project_id, outbox_id, lease_token, lease_until)
    VALUES (c.project_id, c.id, v_token, now() + make_interval(secs => p_lease_seconds))
    ON CONFLICT (project_id) DO NOTHING;
    IF NOT FOUND THEN CONTINUE; END IF; -- another job of this project is leased
    UPDATE public.payment_mirror_outbox SET lease_token = v_token,
      lease_until = now() + make_interval(secs => p_lease_seconds), attempts = attempts + 1, updated_at = now()
     WHERE id = c.id RETURNING * INTO v_row;
    v_got := v_got + 1;
    RETURN NEXT v_row;
  END LOOP;
END $$;

-- Fenced helpers: every write requires the current lease token and an unexpired lease.
CREATE OR REPLACE FUNCTION public.mirror_mark_in_flight(p_id uuid, p_token uuid, p_phase text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.payment_mirror_outbox SET in_flight = p_phase, updated_at = now()
   WHERE id = p_id AND lease_token = p_token AND lease_until > now() AND in_flight IS NULL;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.mirror_set_state(p_id uuid, p_token uuid, p_state text, p_reason text,
  p_tx text DEFAULT NULL, p_retry_seconds integer DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.payment_mirror_outbox SET state = p_state, reason = p_reason, in_flight = NULL,
         ghl_transaction_id = coalesce(p_tx, ghl_transaction_id),
         next_attempt_at = CASE WHEN p_retry_seconds IS NULL THEN next_attempt_at ELSE now() + make_interval(secs => p_retry_seconds) END,
         lease_token = NULL, lease_until = NULL, updated_at = now()
   WHERE id = p_id AND lease_token = p_token AND lease_until > now();
  IF NOT FOUND THEN RETURN false; END IF;
  DELETE FROM public.payment_mirror_project_locks WHERE outbox_id = p_id AND lease_token = p_token;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.mirror_save_link(p_id uuid, p_token uuid, p_invoice text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_proj uuid; v_existing text;
BEGIN
  SELECT r.project_id INTO v_proj FROM public.payment_mirror_outbox o JOIN public.payment_receipts r ON r.id = o.receipt_id
   WHERE o.id = p_id AND o.lease_token = p_token AND o.lease_until > now();
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.project_invoice_links(location_id, project_id, ghl_invoice_id)
  VALUES ('9iqrKUVPDddINb9S4Iwd', v_proj, p_invoice) ON CONFLICT DO NOTHING;
  IF FOUND THEN RETURN true; END IF;
  SELECT ghl_invoice_id INTO v_existing FROM public.project_invoice_links WHERE location_id='9iqrKUVPDddINb9S4Iwd' AND project_id=v_proj;
  RETURN v_existing = p_invoice;
END $$;

-- Context reload under lease (project, contact, link, studio). Studio data comes from app_settings
-- key 'studio_business' ({name,address}); missing => worker keeps the receipt pending.
CREATE OR REPLACE FUNCTION public.mirror_load_context(p_id uuid, p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'receipt', jsonb_build_object('id', r.id, 'project_id', r.project_id, 'ghl_contact_id', r.ghl_contact_id,
       'amount_cents', r.amount_cents, 'paid_on', r.paid_on, 'method', r.method,
       'sources', (SELECT jsonb_agg(jsonb_build_object('source', s.alias, 'source_id', s.source_id)) FROM public.payment_receipt_sources s WHERE s.receipt_id = r.id)),
    'project', (SELECT jsonb_build_object('id', p.id, 'ghl_contact_id', p.ghl_contact_id, 'ghl_opportunity_id', p.ghl_opportunity_id,
       'title', p.title, 'approved_total_eur', p.quoted_total_eur) FROM public.tattoo_projects p WHERE p.id = r.project_id),
    'contact', (SELECT jsonb_build_object('id', c.ghl_contact_id, 'name', c.name, 'email', c.email, 'phone', c.phone)
       FROM public.contacts c WHERE c.ghl_contact_id = r.ghl_contact_id),
    'link', (SELECT jsonb_build_object('project_id', l.project_id, 'invoice_id', l.ghl_invoice_id)
       FROM public.project_invoice_links l WHERE l.location_id='9iqrKUVPDddINb9S4Iwd' AND l.project_id = r.project_id),
    'studio', (SELECT value FROM public.app_settings WHERE key = 'studio_business'))
  INTO v
  FROM public.payment_mirror_outbox o JOIN public.payment_receipts r ON r.id = o.receipt_id
  WHERE o.id = p_id AND o.lease_token = p_token AND o.lease_until > now();
  RETURN v; -- NULL when lease lost
END $$;

REVOKE ALL ON FUNCTION public.claim_payment_mirror(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mirror_mark_in_flight(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mirror_set_state(uuid, uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mirror_save_link(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mirror_load_context(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_payment_mirror(integer, integer), public.mirror_mark_in_flight(uuid, uuid, text),
  public.mirror_set_state(uuid, uuid, text, text, text, integer), public.mirror_save_link(uuid, uuid, text),
  public.mirror_load_context(uuid, uuid) TO service_role;

-- 10) Admin summary for Configurações
CREATE OR REPLACE FUNCTION public.mirror_pending_summary()
RETURNS TABLE(state text, reason text, total bigint) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT o.state, coalesce(o.reason, ''), count(*) FROM public.payment_mirror_outbox o
   WHERE o.state <> 'concluido' GROUP BY 1, 2 ORDER BY 3 DESC;
END $$;
REVOKE ALL ON FUNCTION public.mirror_pending_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mirror_pending_summary() TO authenticated;
