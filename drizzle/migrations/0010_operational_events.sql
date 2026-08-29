-- Fase 5: camada de observabilidade operacional (admin-only, sem PII).

CREATE TYPE public.operational_severity AS ENUM ('critica', 'alta', 'media', 'baixa');
CREATE TYPE public.operational_status AS ENUM ('open', 'acknowledged', 'resolved');

CREATE TABLE public.operational_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL,
  source text NOT NULL,
  kind text NOT NULL,
  severity public.operational_severity NOT NULL DEFAULT 'media',
  status public.operational_status NOT NULL DEFAULT 'open',
  message text NOT NULL,
  safe_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurrences integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX operational_events_open_fingerprint_idx
  ON public.operational_events (fingerprint)
  WHERE status <> 'resolved';

CREATE INDEX operational_events_status_severity_idx
  ON public.operational_events (status, severity, last_seen_at DESC);

GRANT SELECT, UPDATE ON public.operational_events TO authenticated;
GRANT ALL ON public.operational_events TO service_role;

ALTER TABLE public.operational_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read operational events"
  ON public.operational_events FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin'::user_role);

CREATE POLICY "admins update operational events"
  ON public.operational_events FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'admin'::user_role)
  WITH CHECK (public.current_user_role() = 'admin'::user_role);

CREATE TRIGGER operational_events_set_updated_at
  BEFORE UPDATE ON public.operational_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Registro deduplicado por fingerprint. Fail-open é responsabilidade do chamador.
CREATE OR REPLACE FUNCTION public.log_operational_event(
  p_fingerprint text,
  p_source text,
  p_kind text,
  p_severity text,
  p_message text,
  p_safe_context jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_sev public.operational_severity;
BEGIN
  v_sev := COALESCE(NULLIF(p_severity, '')::public.operational_severity, 'media'::public.operational_severity);

  UPDATE public.operational_events
     SET occurrences = occurrences + 1,
         last_seen_at = now(),
         severity = v_sev,
         message = left(COALESCE(p_message, ''), 500),
         safe_context = COALESCE(p_safe_context, '{}'::jsonb),
         status = CASE WHEN status = 'acknowledged' THEN 'acknowledged'::public.operational_status
                       ELSE 'open'::public.operational_status END
   WHERE fingerprint = p_fingerprint
     AND status <> 'resolved'
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.operational_events (fingerprint, source, kind, severity, message, safe_context)
  VALUES (p_fingerprint, COALESCE(NULLIF(p_source, ''), 'app'), COALESCE(NULLIF(p_kind, ''), 'unknown'),
          v_sev, left(COALESCE(p_message, ''), 500), COALESCE(p_safe_context, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_operational_event(text, text, text, text, text, jsonb) TO authenticated, service_role;

-- Métricas consolidadas do painel de saúde (admin apenas).
CREATE OR REPLACE FUNCTION public.operational_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_incidents jsonb;
  v_open int;
  v_critical int;
  v_sync_failures int;
  v_reconciliation int;
  v_mov_pending int;
  v_checkin_pending int;
BEGIN
  IF public.current_user_role() <> 'admin'::user_role THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.sev_rank, e.last_seen_at DESC), '[]'::jsonb)
    INTO v_incidents
    FROM (
      SELECT id, fingerprint, source, kind, severity::text AS severity, status::text AS status,
             message, safe_context, occurrences, first_seen_at, last_seen_at,
             acknowledged_at, resolved_at,
             CASE severity WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END AS sev_rank
        FROM public.operational_events
       WHERE status <> 'resolved'
       ORDER BY sev_rank, last_seen_at DESC
       LIMIT 50
    ) e;

  SELECT count(*) FILTER (WHERE status <> 'resolved'),
         count(*) FILTER (WHERE status <> 'resolved' AND severity = 'critica')
    INTO v_open, v_critical
    FROM public.operational_events;

  SELECT count(*) INTO v_sync_failures FROM public.ghl_sync_failures WHERE resolved_at IS NULL;
  SELECT count(*) INTO v_reconciliation FROM public.booking_operations WHERE status = 'reconciliation_required';
  SELECT count(*) INTO v_mov_pending FROM public.movimentacoes
   WHERE deleted_at IS NULL AND ghl_sync_status = 'failed'::movimentacao_sync_status;
  SELECT count(*) INTO v_checkin_pending FROM public.checkins
   WHERE ghl_sync_status = 'failed'::movimentacao_sync_status;

  RETURN jsonb_build_object(
    'incidents', coalesce(v_incidents, '[]'::jsonb),
    'openCount', coalesce(v_open, 0),
    'criticalCount', coalesce(v_critical, 0),
    'syncFailures', coalesce(v_sync_failures, 0),
    'reconciliationRequired', coalesce(v_reconciliation, 0),
    'movimentacoesFailed', coalesce(v_mov_pending, 0),
    'checkinsFailed', coalesce(v_checkin_pending, 0),
    'generatedAt', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.operational_health() TO authenticated, service_role;
