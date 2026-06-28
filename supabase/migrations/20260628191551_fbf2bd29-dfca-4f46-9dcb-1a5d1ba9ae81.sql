
DROP POLICY IF EXISTS app_users_self ON public.app_users;
CREATE POLICY app_users_self_read ON public.app_users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());
