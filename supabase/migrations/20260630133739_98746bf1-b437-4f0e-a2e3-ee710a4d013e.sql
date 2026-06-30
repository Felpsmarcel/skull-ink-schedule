
-- 1) artists: restrict authenticated SELECT so non-admins only see their own row (with email/phone)
DROP POLICY IF EXISTS "artists_authenticated_read" ON public.artists;

CREATE POLICY "artists_admin_read" ON public.artists
  FOR SELECT TO authenticated
  USING (current_user_role() = 'admin'::user_role);

CREATE POLICY "artists_self_read" ON public.artists
  FOR SELECT TO authenticated
  USING (id = current_artist_id());

-- 2) app_users: block role escalation. Permissive self-update of safe fields only;
--    restrictive policy prevents anyone but admin from changing role/artist_id/id.
CREATE POLICY "app_users_self_update" ON public.app_users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "app_users_no_role_escalation" ON public.app_users
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (
    current_user_role() = 'admin'::user_role
    OR (
      id = auth.uid()
      AND role = (SELECT au.role FROM public.app_users au WHERE au.id = auth.uid())
      AND artist_id IS NOT DISTINCT FROM (SELECT au.artist_id FROM public.app_users au WHERE au.id = auth.uid())
    )
  )
  WITH CHECK (
    current_user_role() = 'admin'::user_role
    OR (
      id = auth.uid()
      AND role = (SELECT au.role FROM public.app_users au WHERE au.id = auth.uid())
      AND artist_id IS NOT DISTINCT FROM (SELECT au.artist_id FROM public.app_users au WHERE au.id = auth.uid())
    )
  );

-- 3) appointments: replace blocked artist SELECT with proper scoped policy
DROP POLICY IF EXISTS "appt_artist_select_blocked" ON public.appointments;

CREATE POLICY "appt_artist_select" ON public.appointments
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'artist'::user_role
    AND artist_id = current_artist_id()
  );
