-- STAGED ONLY: do not apply until diff review and shared-secret provisioning.
-- Does not schedule/activate cron, populate Vault, or import CRM data.
BEGIN;
CREATE TABLE public.ghl_sync_runs (
  id uuid PRIMARY KEY,
  source text NOT NULL CHECK (source IN ('cron','manual')),
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed','expired')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.ghl_sync_runs TO authenticated;
GRANT ALL ON public.ghl_sync_runs TO service_role;
ALTER TABLE public.ghl_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY sync_runs_admin ON public.ghl_sync_runs FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL AND public.current_user_role() = 'admin'::public.user_role);
CREATE INDEX ghl_sync_runs_finished ON public.ghl_sync_runs(end_time DESC) WHERE status='succeeded';

CREATE TABLE public.ghl_sync_lease (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  run_id uuid REFERENCES public.ghl_sync_runs(id),
  expires_at timestamptz NOT NULL DEFAULT '-infinity'
);
GRANT ALL ON public.ghl_sync_lease TO service_role;
ALTER TABLE public.ghl_sync_lease ENABLE ROW LEVEL SECURITY;
INSERT INTO public.ghl_sync_lease(singleton) VALUES(true);

CREATE FUNCTION public.ghl_sync_begin(p_run uuid, p_source text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old uuid;
BEGIN
  SELECT run_id INTO v_old FROM public.ghl_sync_lease WHERE singleton FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.ghl_sync_lease WHERE singleton AND expires_at > clock_timestamp()) THEN RETURN false; END IF;
  UPDATE public.ghl_sync_runs SET status='expired', end_time=clock_timestamp()
    WHERE id=v_old AND status='running';
  INSERT INTO public.ghl_sync_runs(id,source) VALUES(p_run,p_source);
  UPDATE public.ghl_sync_lease SET run_id=p_run, expires_at=clock_timestamp()+interval '5 minutes' WHERE singleton;
  RETURN true;
END $$;

-- Every application-data write locks and verifies the lease in the SAME transaction.
-- An expired worker cannot write after another execution acquires the lease.
CREATE FUNCTION public.ghl_sync_write(p_run uuid, p_kind text, p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM 1 FROM public.ghl_sync_lease WHERE singleton AND run_id=p_run AND expires_at>clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sync lease expired'; END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows)>100 THEN RAISE EXCEPTION 'invalid sync batch'; END IF;
  IF p_kind='contacts' THEN
    WITH changed AS (
      INSERT INTO public.contacts(ghl_contact_id,name,phone,email)
      SELECT ghl_contact_id,name,phone,email FROM jsonb_to_recordset(p_rows) AS x(ghl_contact_id text,name text,phone text,email text)
      ON CONFLICT(ghl_contact_id) DO UPDATE SET name=excluded.name,phone=excluded.phone,email=excluded.email
      RETURNING id,ghl_contact_id
    ) SELECT coalesce(jsonb_agg(to_jsonb(changed)),'[]') INTO v_result FROM changed;
  ELSIF p_kind='insert' THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_rows) x(artist_id uuid,calendar_id text,commission_pct numeric)
      LEFT JOIN public.artists a ON a.id=x.artist_id
      WHERE a.id IS NULL OR NOT a.active OR a.ghl_calendar_id IS DISTINCT FROM x.calendar_id
        OR a.commission_pct IS DISTINCT FROM x.commission_pct OR x.commission_pct IS NULL
    ) THEN RAISE EXCEPTION 'calendar or commission conflict'; END IF;
    WITH changed AS (
      INSERT INTO public.appointments(ghl_appointment_id,ghl_contact_id,contact_id,artist_id,calendar_id,contact_name,contact_phone,contact_email,start_at,end_at,status,commission_pct,notes)
      SELECT ghl_appointment_id,ghl_contact_id,contact_id,artist_id,calendar_id,contact_name,contact_phone,contact_email,start_at,end_at,status::public.appt_status,commission_pct,notes
      FROM jsonb_to_recordset(p_rows) x(ghl_appointment_id text,ghl_contact_id text,contact_id uuid,artist_id uuid,calendar_id text,contact_name text,contact_phone text,contact_email text,start_at timestamptz,end_at timestamptz,status text,commission_pct numeric,notes text)
      ON CONFLICT(ghl_appointment_id) DO NOTHING RETURNING ghl_appointment_id
    ) SELECT coalesce(jsonb_agg(to_jsonb(changed)),'[]') INTO v_result FROM changed;
  ELSIF p_kind='update' THEN
    -- Lock target rows before checking ownership to prevent manual-reassignment races.
    PERFORM 1 FROM public.appointments a JOIN jsonb_to_recordset(p_rows) x(ghl_appointment_id text)
      ON a.ghl_appointment_id=x.ghl_appointment_id FOR UPDATE OF a;
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_rows) x(ghl_appointment_id text,artist_id uuid,calendar_id text)
      LEFT JOIN public.appointments a ON a.ghl_appointment_id=x.ghl_appointment_id
      WHERE a.id IS NULL OR a.artist_id IS DISTINCT FROM x.artist_id OR a.calendar_id IS DISTINCT FROM x.calendar_id
    ) THEN RAISE EXCEPTION 'event ownership conflict'; END IF;
    WITH changed AS (
      UPDATE public.appointments a SET start_at=x.start_at,end_at=x.end_at,status=x.status::public.appt_status,
        contact_name=coalesce(x.contact_name,a.contact_name),contact_phone=coalesce(x.contact_phone,a.contact_phone),
        contact_email=coalesce(x.contact_email,a.contact_email),ghl_contact_id=x.ghl_contact_id,contact_id=coalesce(x.contact_id,a.contact_id)
      FROM jsonb_to_recordset(p_rows) x(ghl_appointment_id text,start_at timestamptz,end_at timestamptz,status text,contact_name text,contact_phone text,contact_email text,ghl_contact_id text,contact_id uuid)
      WHERE a.ghl_appointment_id=x.ghl_appointment_id RETURNING a.ghl_appointment_id
    ) SELECT coalesce(jsonb_agg(to_jsonb(changed)),'[]') INTO v_result FROM changed;
  ELSE RAISE EXCEPTION 'invalid sync operation'; END IF;
  RETURN v_result;
END $$;

CREATE FUNCTION public.ghl_sync_finish(p_run uuid,p_result jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_valid boolean;
BEGIN
  SELECT expires_at>clock_timestamp() INTO v_valid FROM public.ghl_sync_lease WHERE singleton AND run_id=p_run FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sync ownership lost'; END IF;
  UPDATE public.ghl_sync_runs SET end_time=clock_timestamp(),
    status=CASE WHEN NOT v_valid THEN 'expired' WHEN p_result->>'ok'='true' AND coalesce((p_result->>'failures')::integer,1)=0 THEN 'succeeded' ELSE 'failed' END,
    result=p_result WHERE id=p_run AND status='running';
  UPDATE public.ghl_sync_lease SET expires_at='-infinity' WHERE singleton AND run_id=p_run;
END $$;
REVOKE ALL ON FUNCTION public.ghl_sync_begin(uuid,text),public.ghl_sync_write(uuid,text,jsonb),public.ghl_sync_finish(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ghl_sync_begin(uuid,text),public.ghl_sync_write(uuid,text,jsonb),public.ghl_sync_finish(uuid,jsonb) TO service_role;

-- Effective broad policy verified on 2026-11-03; preserve existing own/admin/seller policies.
DROP POLICY IF EXISTS appt_artist_select_all ON public.appointments;
CREATE POLICY appt_artist_scope_guard ON public.appointments AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.current_user_role() IS DISTINCT FROM 'artist'::public.user_role OR artist_id=public.current_artist_id());

CREATE OR REPLACE FUNCTION public.ghl_sync_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role() IS DISTINCT FROM 'admin'::public.user_role THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'job',(SELECT to_jsonb(j) FROM (SELECT jobname,schedule,active FROM cron.job WHERE jobname='ghl-sync-10min') j),
    'runs',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM (SELECT start_time,end_time,
      CASE WHEN status='running' AND start_time<now()-interval '5 minutes' THEN 'expired' ELSE status END AS status,
      CASE WHEN status='failed' THEN 'Falha parcial ou total' END AS return_message FROM public.ghl_sync_runs ORDER BY start_time DESC LIMIT 5) r),'[]'),
    'last_success_at',(SELECT max(end_time) FROM public.ghl_sync_runs WHERE status='succeeded'),
    'latest_status',(SELECT CASE WHEN status='running' AND start_time<now()-interval '5 minutes' THEN 'expired' ELSE status END FROM public.ghl_sync_runs ORDER BY start_time DESC LIMIT 1),
    'vault_ok',EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='ghl_sync_secret' AND decrypted_secret IS NOT NULL AND decrypted_secret<>'')) INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.schedule_ghl_sync() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job bigint;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role() IS DISTINCT FROM 'admin'::public.user_role THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='ghl_sync_secret' AND decrypted_secret IS NOT NULL AND decrypted_secret<>'') THEN RAISE EXCEPTION 'Private shared secret not configured'; END IF;
  -- Called only after review: consolidate all three existing appointment jobs.
  FOR v_job IN SELECT jobid FROM cron.job WHERE jobname IN ('ghl-sync-10min','sync-ghl-appointments','gf-sync-ghl-appointments-10min') LOOP
    PERFORM cron.unschedule(v_job);
  END LOOP;
  PERFORM cron.schedule('ghl-sync-10min','*/10 * * * *',$cmd$
    SELECT net.http_post(
      url:='https://www.gftattoocalendar.com/api/public/hooks/sync-ghl',
      headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='ghl_sync_secret')),
      body:='{}'::jsonb,timeout_milliseconds:=270000
    );
  $cmd$);
  RETURN 'queued schedule configured; not a completed sync';
END $$;
CREATE OR REPLACE FUNCTION public.unschedule_ghl_sync() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job bigint;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role() IS DISTINCT FROM 'admin'::public.user_role THEN RAISE EXCEPTION 'forbidden'; END IF;
  FOR v_job IN SELECT jobid FROM cron.job WHERE jobname IN ('ghl-sync-10min','sync-ghl-appointments','gf-sync-ghl-appointments-10min') LOOP PERFORM cron.unschedule(v_job); END LOOP;
  RETURN 'unscheduled';
END $$;
REVOKE ALL ON FUNCTION public.ghl_sync_status(),public.schedule_ghl_sync(),public.unschedule_ghl_sync() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.ghl_sync_status(),public.schedule_ghl_sync(),public.unschedule_ghl_sync() TO authenticated;
COMMIT;
