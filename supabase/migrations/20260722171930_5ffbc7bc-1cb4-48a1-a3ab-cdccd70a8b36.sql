-- 1) Soft delete column + updated_at trigger
ALTER TABLE public.movimentacoes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_movimentacoes_deleted_at
  ON public.movimentacoes (deleted_at);

-- 2) Revoke broad anon SELECT (security tightening)
DROP POLICY IF EXISTS movimentacoes_public_select ON public.movimentacoes;
DROP POLICY IF EXISTS artists_public_select_name ON public.artists;
REVOKE SELECT ON public.movimentacoes FROM anon;
REVOKE SELECT ON public.artists FROM anon;

-- 3) Owner update / soft-delete policy (admin already covered by movimentacoes_admin_all)
DROP POLICY IF EXISTS movimentacoes_owner_update ON public.movimentacoes;
CREATE POLICY movimentacoes_owner_update ON public.movimentacoes
  FOR UPDATE TO authenticated
  USING (recebido_por_app_user_id = auth.uid())
  WITH CHECK (recebido_por_app_user_id = auth.uid());

-- 4) Public history via SECURITY DEFINER function (safe columns only, hide deleted)
CREATE OR REPLACE FUNCTION public.list_movimentacoes_historico(
  p_page      int DEFAULT 1,
  p_page_size int DEFAULT 15
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  nome_cliente text,
  tatuador text,
  link_origem text,
  tipo_movimento text,
  valor_cartao numeric,
  valor_dinheiro numeric,
  valor_sumup numeric,
  valor_transferencia numeric,
  total numeric,
  ghl_sync_status text,
  total_count bigint,
  total_valor numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from int;
  v_to   int;
  v_count bigint;
  v_sum numeric;
BEGIN
  IF p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 50 THEN
    p_page_size := 15;
  END IF;
  IF p_page IS NULL OR p_page < 1 THEN
    p_page := 1;
  END IF;
  v_from := (p_page - 1) * p_page_size;
  v_to   := v_from + p_page_size - 1;

  SELECT count(*), coalesce(sum(m.total), 0)
    INTO v_count, v_sum
    FROM public.movimentacoes m
   WHERE m.deleted_at IS NULL;

  RETURN QUERY
    SELECT
      m.id,
      m.created_at,
      m.nome_cliente,
      a.name AS tatuador,
      m.link_origem,
      m.tipo_movimento::text,
      m.valor_cartao,
      m.valor_dinheiro,
      m.valor_sumup,
      m.valor_transferencia,
      m.total,
      m.ghl_sync_status::text,
      v_count,
      v_sum
    FROM public.movimentacoes m
    LEFT JOIN public.artists a ON a.id = m.artist_id
    WHERE m.deleted_at IS NULL
    ORDER BY m.created_at DESC
    OFFSET v_from
    LIMIT p_page_size;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_movimentacoes_historico(int, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.find_movimentacao_page(
  p_id uuid,
  p_page_size int DEFAULT 15
)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created timestamptz;
  v_position bigint;
BEGIN
  IF p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 50 THEN
    p_page_size := 15;
  END IF;

  SELECT created_at INTO v_created
    FROM public.movimentacoes
   WHERE id = p_id AND deleted_at IS NULL;
  IF v_created IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*) + 1 INTO v_position
    FROM public.movimentacoes
   WHERE deleted_at IS NULL AND created_at > v_created;

  RETURN ceil(v_position::numeric / p_page_size)::int;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_movimentacao_page(uuid, int) TO anon, authenticated;
