-- REVIEW ONLY — NOT A MIGRATION, NOT APPLIED.
-- Apply only through the separately approved migration workflow after staging evidence.
-- Default ROLLBACK at the bottom prevents this review script from committing accidentally.
-- Inspect live grants, policies, owners, indexes, triggers and RPC signatures before adoption.
--
-- RELEASE GATE: artist access to the real app remains unapproved while broad live checkins
-- policies / SECURITY DEFINER RPC permissions survive. A UI button or server role check
-- does not fence a direct authenticated REST/RPC call. This proposal makes queue operations
-- reception/admin-only; it does NOT activate an artist queue or a public autonomous kiosk.
--
-- Further gates, intentionally not solved here:
--  * next_checkin_codigo() uses count()+1 and can assign the same display code concurrently.
--    Review a transactional counter/sequence before production rollout; never use code as identity.
--  * new walk-ins without contact/phone cannot be deduplicated by the existing identity key.
--  * public token RPC and its expiration/privacy model need a separate review (unchanged here).
--  * confirm/check-in CRM sync remains a live write; staging verification must use isolated adapters.

BEGIN;

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- Remove known broad staff policies. RESTRICTIVE guard also fences any remaining permissive
-- policy overlooked by a live inventory; it must coexist with a legitimate permissive grant.
DROP POLICY IF EXISTS checkins_select_staff ON public.checkins;
DROP POLICY IF EXISTS checkins_insert_staff ON public.checkins;
DROP POLICY IF EXISTS checkins_update_staff ON public.checkins;
DROP POLICY IF EXISTS checkins_admin_scope_guard ON public.checkins;
DROP POLICY IF EXISTS checkins_admin_select ON public.checkins;
DROP POLICY IF EXISTS checkins_admin_update ON public.checkins;

CREATE POLICY checkins_admin_scope_guard ON public.checkins
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL AND public.current_user_role() = 'admin'::public.user_role)
  WITH CHECK (auth.uid() IS NOT NULL AND public.current_user_role() = 'admin'::public.user_role);
CREATE POLICY checkins_admin_select ON public.checkins
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND public.current_user_role() = 'admin'::public.user_role);
CREATE POLICY checkins_admin_update ON public.checkins
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.current_user_role() = 'admin'::public.user_role)
  WITH CHECK (auth.uid() IS NOT NULL AND public.current_user_role() = 'admin'::public.user_role);

-- New arrivals keep using the canonically validated service handler. Queue updates use
-- the user-context client and only need lifecycle columns. No public inserts or deletes.
REVOKE ALL ON public.checkins FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.checkins TO authenticated;
GRANT UPDATE (status, started_at, finished_at) ON public.checkins TO authenticated;
GRANT ALL ON public.checkins TO service_role;

-- One active arrival per verified client + Brussels civil day + distinct appointment.
-- The literal walk-in bucket cannot collide with any appointment UUID. Do not merge IDs.
-- Check existing data and fail visibly rather than silently delete or consolidate duplicates.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.checkins
     WHERE status IN ('aguardando','em_atendimento')
       AND COALESCE(ghl_contact_id, contact_id::text, cliente_telefone) IS NOT NULL
     GROUP BY COALESCE(ghl_contact_id, contact_id::text, cliente_telefone),
              ((arrived_at AT TIME ZONE 'Europe/Brussels')::date),
              COALESCE(appointment_id::text, 'walk-in')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_active_checkin_identity_requires_review';
  END IF;
END;
$$;
DROP INDEX IF EXISTS public.checkins_active_daily_uniq;
CREATE UNIQUE INDEX checkins_active_daily_uniq ON public.checkins (
  COALESCE(ghl_contact_id, contact_id::text, cliente_telefone),
  ((arrived_at AT TIME ZONE 'Europe/Brussels')::date),
  COALESCE(appointment_id::text, 'walk-in')
) WHERE status IN ('aguardando','em_atendimento')
    AND COALESCE(ghl_contact_id, contact_id::text, cliente_telefone) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.list_checkins_hoje()
RETURNS TABLE(
  id uuid,
  cliente_nome text,
  codigo_atendimento text,
  status text,
  arrived_at timestamptz,
  started_at timestamptz,
  scheduled_at timestamptz,
  artist_id uuid,
  tatuador text,
  appointment_id uuid,
  ghl_sync_status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'Europe/Brussels')::date;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role() IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_start := v_day::timestamp AT TIME ZONE 'Europe/Brussels';
  v_end := (v_day + 1)::timestamp AT TIME ZONE 'Europe/Brussels';
  RETURN QUERY
  SELECT c.id, c.cliente_nome, c.codigo_atendimento, c.status::text,
         c.arrived_at, c.started_at, c.scheduled_at,
         c.artist_id, a.name, c.appointment_id, c.ghl_sync_status::text
    FROM public.checkins c
    LEFT JOIN public.artists a ON a.id = c.artist_id
   WHERE c.arrived_at >= v_start AND c.arrived_at < v_end
   ORDER BY CASE c.status WHEN 'em_atendimento' THEN 0 WHEN 'aguardando' THEN 1 ELSE 2 END,
            c.arrived_at ASC, c.id ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.list_checkins_hoje() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_checkins_hoje() TO authenticated;

-- REQUIRED STAGING CHECKS:
-- 1) anonymous/artist/seller/unknown identities cannot select/insert/update table rows or call RPC.
-- 2) admin can read today's queue and CAS-update one legal transition using the app handler.
-- 3) two concurrent updates: exactly one affected row; losing caller gets a conflict, never ok:true.
-- 4) October 25 / March 29 Brussels days include 25 / 23 hours and exclude next midnight.
-- 5) two appointment IDs for the same client/day coexist; a repeated same appointment conflicts.
-- 6) existing records, tokens, timestamps and CRM IDs remain intact.
-- 7) direct admin column grants cannot alter contact/artist/appointment identity.
-- 8) inspect whether column grants in the live database also need explicit per-column revocation.

ROLLBACK;
