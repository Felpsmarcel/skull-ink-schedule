-- REVIEW ONLY. Not applied. Outbox for mirroring confirmed receipts into GHL invoices.
-- Apply only after explicit approval.

ALTER TABLE public.movimentacoes
  ADD COLUMN IF NOT EXISTS confirmacao_status text NOT NULL DEFAULT 'informado'
    CHECK (confirmacao_status IN ('informado','confirmado','rejeitado')),
  ADD COLUMN IF NOT EXISTS confirmado_por uuid,
  ADD COLUMN IF NOT EXISTS confirmado_em timestamptz;

CREATE TABLE IF NOT EXISTS public.payment_mirror_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('movimentacao','payment')),
  source_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  paid_on date NOT NULL,
  method text NOT NULL,
  ghl_contact_id text NOT NULL,
  ghl_opportunity_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','queued','sent','failed','dead')),
  reason text,
  attempts integer NOT NULL DEFAULT 0,
  lease_token uuid,
  lease_until timestamptz,
  ghl_invoice_id text,
  ghl_payment_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);

ALTER TABLE public.payment_mirror_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_mirror_outbox FROM anon, authenticated;
GRANT SELECT ON public.payment_mirror_outbox TO authenticated;
CREATE POLICY "admin reads outbox" ON public.payment_mirror_outbox
  FOR SELECT TO authenticated USING (public.current_user_role() = 'admin');

-- Admin confirmation + enqueue in one transaction; idempotent via UNIQUE.
CREATE OR REPLACE FUNCTION public.confirm_movimentacao(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.movimentacoes;
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO m FROM public.movimentacoes WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF m.tipo_movimento = 'estorno' THEN RAISE EXCEPTION 'estorno_nao_espelhado'; END IF;
  IF m.ghl_contact_id IS NULL THEN RAISE EXCEPTION 'contato_ausente'; END IF;
  UPDATE public.movimentacoes SET confirmacao_status = 'confirmado',
    confirmado_por = auth.uid(), confirmado_em = now() WHERE id = p_id;
  INSERT INTO public.payment_mirror_outbox
    (source, source_id, amount_cents, paid_on, method, ghl_contact_id, ghl_opportunity_id)
  VALUES ('movimentacao', m.id, round(coalesce(m.total,0) * 100)::int, m.data_pagamento,
    coalesce(m.forma_pagamento::text, 'other'), m.ghl_contact_id, m.ghl_opportunity_id)
  ON CONFLICT (source, source_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.confirm_movimentacao(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_movimentacao(uuid) TO authenticated;
