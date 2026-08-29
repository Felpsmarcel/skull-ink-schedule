-- Restringe o acesso direto à tabela checkins (que contém telefone, consentimento
-- e tokens de QR do cliente). Admins mantêm acesso total; tatuadores só às suas
-- próprias linhas. A fila do dia continua a funcionar para toda a equipa através
-- da função SECURITY DEFINER public.list_checkins_hoje(), que não devolve PII.
DROP POLICY IF EXISTS checkins_select_staff ON public.checkins;
DROP POLICY IF EXISTS checkins_insert_staff ON public.checkins;
DROP POLICY IF EXISTS checkins_update_staff ON public.checkins;

CREATE POLICY checkins_select_admin_or_own_artist ON public.checkins
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'admin'
    OR (public.current_artist_id() IS NOT NULL AND artist_id = public.current_artist_id())
  );

CREATE POLICY checkins_insert_admin ON public.checkins
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY checkins_update_admin_or_own_artist ON public.checkins
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    OR (public.current_artist_id() IS NOT NULL AND artist_id = public.current_artist_id())
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR (public.current_artist_id() IS NOT NULL AND artist_id = public.current_artist_id())
  );