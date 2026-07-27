CREATE OR REPLACE FUNCTION public.get_movimentacoes_report(
  p_start timestamptz,
  p_end timestamptz,
  p_artist uuid DEFAULT NULL,
  p_tipo text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  data_pagamento date,
  nome_cliente text,
  artist_id uuid,
  tatuador text,
  recebido_por_app_user_id uuid,
  link_origem text,
  tipo_movimento text,
  valor_cartao numeric,
  valor_dinheiro numeric,
  valor_sumup numeric,
  valor_transferencia numeric,
  total numeric,
  ghl_sync_status text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_role user_role;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_role := public.current_user_role();

  RETURN QUERY
  SELECT
    m.id,
    m.created_at,
    m.data_pagamento,
    m.nome_cliente,
    m.artist_id,
    a.name AS tatuador,
    m.recebido_por_app_user_id,
    m.link_origem,
    m.tipo_movimento::text,
    m.valor_cartao,
    m.valor_dinheiro,
    m.valor_sumup,
    m.valor_transferencia,
    m.total,
    m.ghl_sync_status::text
  FROM public.movimentacoes m
  LEFT JOIN public.artists a ON a.id = m.artist_id
  WHERE m.deleted_at IS NULL
    AND m.data_pagamento >= p_start::date
    AND m.data_pagamento <= p_end::date
    AND (v_role = 'admin'::user_role OR m.recebido_por_app_user_id = v_uid)
    AND (p_artist IS NULL OR m.artist_id = p_artist)
    AND (p_tipo IS NULL OR m.tipo_movimento::text = p_tipo)
  ORDER BY m.data_pagamento DESC, m.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_movimentacoes_report(timestamptz, timestamptz, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_movimentacoes_report(timestamptz, timestamptz, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_movimentacoes_report(timestamptz, timestamptz, uuid, text) TO service_role;