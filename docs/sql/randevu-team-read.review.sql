-- REVIEW-ONLY. NÃO APLICAR sem aprovação explícita. Amplia leitura real.
-- Objetivo: equipe autenticada (admin/artist ativo) lê apenas campos operacionais
-- do calendário Randevu configurado; sem notas, finanças ou outros calendários.
-- A guarda RESTRICTIVE appt_artist_scope_guard continua valendo na tabela;
-- por isso a leitura é por função SECURITY DEFINER com projeção explícita.
CREATE OR REPLACE FUNCTION public.list_shared_randevu(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(id uuid, start_at timestamptz, end_at timestamptz, status text, contact_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.current_user_role() NOT IN ('admin'::public.user_role,'artist'::public.user_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_to <= p_from OR p_to - p_from > interval '45 days' THEN RAISE EXCEPTION 'invalid_range'; END IF;
  RETURN QUERY
    SELECT a.id, a.start_at, a.end_at, a.status::text, a.contact_name
    FROM public.appointments a
    JOIN public.artists r ON r.id = a.artist_id
    WHERE r.ghl_calendar_id = 'NzAYeRNJnvfpu7ynyoEK'
      AND a.start_at >= p_from AND a.start_at < p_to
    ORDER BY a.start_at LIMIT 500;
END $$;
REVOKE ALL ON FUNCTION public.list_shared_randevu(timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_shared_randevu(timestamptz,timestamptz) TO authenticated;
