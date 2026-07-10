-- Tatuadores podem ler todos os agendamentos para visualizar a agenda geral do estúdio.
CREATE POLICY "appt_artist_select_all"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'artist'::public.user_role);

-- Tatuadores podem listar todos os artistas ativos para renderizar as colunas da agenda.
CREATE POLICY "artists_artist_read_active"
  ON public.artists
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'artist'::public.user_role AND active = true);