-- REVIEW ONLY. NOT APPLIED. Apply only AFTER payment-mirror-outbox.review.sql is reviewed/applied.
-- Additive admin read RPC. No triggers, confirmation, enqueue, backfill or external calls.
-- Dates use the same Europe/Brussels civil date as the reviewed receipt loader.
-- A deposit is one physical payments row: the booking_deposit alias is never UNIONed again.
CREATE OR REPLACE FUNCTION public.mirror_receipt_candidates(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_include_historical boolean DEFAULT false
) RETURNS TABLE (
  source text, source_id uuid, project_id uuid,
  client_name text, project_title text, paid_on date, amount_cents integer, method text,
  confirmation_status text, mirror_state text, block_reason text, possible_duplicate boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Brussels')::date;
  v_from date := coalesce(p_from, v_today - 29);
  v_to date := coalesce(p_to, v_today);
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100
     OR v_to < v_from OR v_to - v_from > 365 OR v_to > v_today THEN
    RAISE EXCEPTION 'periodo_ou_limite_invalido';
  END IF;
  IF v_from < v_today - 29 AND p_include_historical IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'historico_exige_consulta_explicita';
  END IF;

  RETURN QUERY
  WITH raw AS (
    SELECT 'payment'::text AS src, p.id AS sid, a.project_id AS pid,
      left(coalesce(nullif(c.name, ''), 'Cliente sem nome'), 500) AS cname,
      c.ghl_contact_id AS cid,
      left(coalesce(nullif(t.title, ''), 'Projeto por vincular'), 500) AS title,
      t.ghl_contact_id AS project_contact,
      (p.paid_at AT TIME ZONE 'Europe/Brussels')::date AS payment_date,
      p.amount_eur AS amount, coalesce(p.method::text, 'other') AS payment_method,
      p.confirmacao_status AS confirmation
    FROM public.payments p
    LEFT JOIN public.contacts c ON c.id = p.contact_id
    LEFT JOIN public.appointments a ON a.id = p.appointment_id
    LEFT JOIN public.tattoo_projects t ON t.id = a.project_id
    WHERE p.status = 'paid' AND p.type <> 'refund'
      AND (p.paid_at AT TIME ZONE 'Europe/Brussels')::date BETWEEN v_from AND v_to
    UNION ALL
    SELECT 'movimentacao'::text, m.id, m.project_id,
      left(coalesce(nullif(m.nome_cliente, ''), nullif(c.name, ''), 'Cliente sem nome'), 500),
      m.ghl_contact_id,
      left(coalesce(nullif(t.title, ''), nullif(m.descricao_projeto, ''), 'Projeto por vincular'), 500),
      t.ghl_contact_id, m.data_pagamento,
      coalesce(m.total, m.valor_cartao + m.valor_dinheiro + m.valor_sumup + m.valor_transferencia),
      coalesce(m.forma_pagamento::text, 'other'), m.confirmacao_status
    FROM public.movimentacoes m
    LEFT JOIN public.contacts c ON c.ghl_contact_id = m.ghl_contact_id
    LEFT JOIN public.tattoo_projects t ON t.id = m.project_id
    WHERE m.deleted_at IS NULL AND m.tipo_movimento <> 'estorno'
      AND m.data_pagamento BETWEEN v_from AND v_to
  ), mapped AS (
    SELECT r.*, s.receipt_id, o.state AS mirror_status
    FROM raw r
    LEFT JOIN public.payment_receipt_sources s ON s.source = r.src AND s.source_id = r.sid
    LEFT JOIN public.payment_mirror_outbox o ON o.receipt_id = s.receipt_id
  ), canonical AS (
    -- Distinct physical IDs remain separate. Only an explicit source map proves the same receipt.
    SELECT DISTINCT ON (coalesce('receipt:' || r.receipt_id::text, r.src || ':' || r.sid::text)) r.*
    FROM mapped r
    ORDER BY coalesce('receipt:' || r.receipt_id::text, r.src || ':' || r.sid::text), r.src, r.sid
  ), checked AS (
    SELECT r.*,
      CASE WHEN r.amount > 0 AND r.amount * 100 = round(r.amount * 100)
                      AND r.amount * 100 <= 2147483647
        THEN (r.amount * 100)::integer ELSE NULL END AS cents,
      CASE
        WHEN r.confirmation = 'rejeitado' THEN 'rejeitado'
        WHEN r.pid IS NULL THEN 'projeto_ausente'
        WHEN nullif(r.cid, '') IS NULL THEN 'contato_ausente'
        WHEN r.project_contact IS DISTINCT FROM r.cid THEN 'contato_divergente'
        WHEN r.amount IS NULL OR r.amount <= 0 OR r.amount * 100 <> round(r.amount * 100)
             OR r.amount * 100 > 2147483647 THEN 'valor_invalido'
        WHEN r.payment_date IS NULL THEN 'data_ausente'
        WHEN (r.confirmation = 'confirmado') IS DISTINCT FROM (r.receipt_id IS NOT NULL)
          THEN 'confirmacao_inconsistente'
        ELSE NULL END AS issue,
      count(*) OVER (PARTITION BY r.pid, r.cid, r.payment_date, r.amount) > 1
        AND r.pid IS NOT NULL AND r.cid IS NOT NULL AS duplicate_hint
    FROM canonical r
  )
  SELECT r.src, r.sid, r.pid, r.cname, r.title, r.payment_date, r.cents,
    r.payment_method, r.confirmation, r.mirror_status, r.issue, r.duplicate_hint
  FROM checked r
  ORDER BY r.payment_date DESC, r.src, r.sid
  LIMIT p_limit;
END $$;
REVOKE ALL ON FUNCTION public.mirror_receipt_candidates(date, date, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mirror_receipt_candidates(date, date, integer, boolean) TO authenticated;
COMMENT ON FUNCTION public.mirror_receipt_candidates(date, date, integer, boolean) IS
  'Admin-only read queue, max 100 rows; recent 30 civil days by default. Historical consultation is explicit and never enqueues.';
