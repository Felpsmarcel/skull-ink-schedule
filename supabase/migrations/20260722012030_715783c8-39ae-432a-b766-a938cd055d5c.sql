GRANT SELECT ON public.movimentacoes TO anon;
GRANT SELECT ON public.artists TO anon;

DROP POLICY IF EXISTS movimentacoes_public_select ON public.movimentacoes;
CREATE POLICY movimentacoes_public_select ON public.movimentacoes
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS artists_public_select_name ON public.artists;
CREATE POLICY artists_public_select_name ON public.artists
  FOR SELECT TO anon USING (true);