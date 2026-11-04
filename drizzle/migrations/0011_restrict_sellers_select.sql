DROP POLICY IF EXISTS "Authenticated can view sellers" ON public.sellers;
CREATE POLICY "Admins or own seller can view sellers" ON public.sellers FOR SELECT TO authenticated
USING (public.current_user_role() = 'admin'::public.user_role OR id = public.current_seller_id());