
-- 1) Coluna comissão em artists (usada no onboarding).
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS commission_pct numeric NOT NULL DEFAULT 40
    CHECK (commission_pct >= 0 AND commission_pct <= 100);

-- 2) Extensões para agendamento.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3) Vault secret placeholder (valor real é setado por admin fora da migration).
--    Se o vault já tiver a secret, mantemos.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'ghl_sync_anon_key') THEN
    PERFORM vault.create_secret('__set_me__', 'ghl_sync_anon_key',
      'Anon/publishable key used by pg_cron to authenticate the /api/public/hooks/sync-ghl route.');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'vault.create_secret skipped: %', SQLERRM;
END $$;

-- 4) URL base do endpoint (hardcoded para o projeto).
--    Se mudar de projeto, atualizar aqui.
CREATE OR REPLACE FUNCTION public.schedule_ghl_sync()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anon text;
  v_url  text := 'https://project--03a6f57d-9b2a-4876-a3b5-a886d4f4b51d.lovable.app/api/public/hooks/sync-ghl';
  v_cmd  text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT decrypted_secret INTO v_anon
    FROM vault.decrypted_secrets
    WHERE name = 'ghl_sync_anon_key';

  IF v_anon IS NULL OR v_anon = '__set_me__' OR length(v_anon) < 20 THEN
    RAISE EXCEPTION 'vault secret ghl_sync_anon_key não configurado';
  END IF;

  -- Remove agendamento anterior (idempotente).
  PERFORM cron.unschedule('ghl-sync-10min')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ghl-sync-10min');

  v_cmd := format(
    $cmd$SELECT net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ghl_sync_anon_key')
      ),
      body := '{}'::jsonb
    );$cmd$,
    v_url
  );

  PERFORM cron.schedule('ghl-sync-10min', '*/10 * * * *', v_cmd);
  RETURN 'scheduled';
END;
$$;

CREATE OR REPLACE FUNCTION public.unschedule_ghl_sync()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  PERFORM cron.unschedule('ghl-sync-10min')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ghl-sync-10min');
  RETURN 'unscheduled';
END;
$$;

CREATE OR REPLACE FUNCTION public.ghl_sync_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jsonb;
  v_runs jsonb;
  v_vault_ok boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT to_jsonb(j) INTO v_job
    FROM (
      SELECT jobname, schedule, active
      FROM cron.job
      WHERE jobname = 'ghl-sync-10min'
    ) j;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.start_time DESC), '[]'::jsonb) INTO v_runs
    FROM (
      SELECT start_time, end_time, status, return_message
      FROM cron.job_run_details d
      JOIN cron.job j ON j.jobid = d.jobid
      WHERE j.jobname = 'ghl-sync-10min'
      ORDER BY d.start_time DESC
      LIMIT 5
    ) r;

  SELECT (decrypted_secret IS NOT NULL AND decrypted_secret <> '__set_me__' AND length(decrypted_secret) >= 20)
    INTO v_vault_ok
    FROM vault.decrypted_secrets
    WHERE name = 'ghl_sync_anon_key';

  RETURN jsonb_build_object(
    'job', v_job,
    'runs', coalesce(v_runs, '[]'::jsonb),
    'vault_ok', coalesce(v_vault_ok, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.schedule_ghl_sync()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.unschedule_ghl_sync() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ghl_sync_status()    TO authenticated;
