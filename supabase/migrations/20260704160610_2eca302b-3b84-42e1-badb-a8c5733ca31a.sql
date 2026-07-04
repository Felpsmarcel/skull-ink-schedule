-- 1) Lock down SECURITY DEFINER functions from anon/PUBLIC.
-- These functions already enforce role checks internally or are cron-invoked;
-- they must not be callable by unauthenticated clients.
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch()       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake()           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ghl_sync_status()            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.schedule_ghl_sync()          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unschedule_ghl_sync()        FROM PUBLIC, anon;

-- Admin-callable helpers stay reachable by signed-in users; the function body
-- rejects non-admins.
GRANT EXECUTE ON FUNCTION public.ghl_sync_status()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_ghl_sync()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.unschedule_ghl_sync()  TO authenticated;

-- 2) Explicit restrictive INSERT policy on app_users so no non-admin path can
-- insert a row and self-assign a role or artist link. The existing
-- `app_users_admin_write` (FOR ALL) already permits admin inserts; adding a
-- RESTRICTIVE policy makes the intent explicit and defends against any future
-- permissive INSERT policy being added by mistake.
DROP POLICY IF EXISTS app_users_insert_admin_only ON public.app_users;
CREATE POLICY app_users_insert_admin_only
  ON public.app_users
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin'::user_role);