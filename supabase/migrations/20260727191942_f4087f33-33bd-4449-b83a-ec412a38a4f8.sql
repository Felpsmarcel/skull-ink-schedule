CREATE OR REPLACE FUNCTION public.get_movimentacoes_report(
  p_start timestamp with time zone,
  p_end timestamp with time zone,
  p_artist uuid DEFAULT NULL::uuid,
  p_tipo text DEFAULT NULL::text,
  p_recebedor uuid DEFAULT NULL::uuid,
  p_sync_status text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid,
  created_at timestamp with time zone,
  data_pagamento date,
  nome_cliente text,
  artist_id uuid,
  tatuador text,
  recebido_por_app_user_id uuid,
  recebido_por_nome text,
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
    COALESCE(au.name, u.email, m.recebido_por_app_user_id::text) AS recebido_por_nome,
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
  LEFT JOIN public.app_users u ON u.id = m.recebido_por_app_user_id
  LEFT JOIN public.app_settings au ON au.key = 'recebedor_name:' || m.recebido_por_app_user_id::text
  WHERE m.deleted_at IS NULL
    AND m.data_pagamento >= p_start::date
    AND m.data_pagamento <= p_end::date
    AND (v_role = 'admin'::user_role OR m.recebido_por_app_user_id = v_uid)
    AND (p_artist IS NULL OR m.artist_id = p_artist)
    AND (p_tipo IS NULL OR m.tipo_movimento::text = p_tipo)
    AND (p_recebedor IS NULL OR m.recebido_por_app_user_id = p_recebedor)
    AND (p_sync_status IS NULL OR m.ghl_sync_status::text = p_sync_status)
  ORDER BY m.data_pagamento DESC, m.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_movimentacoes_report(timestamp with time zone, timestamp with time zone, uuid, text, uuid, text) TO authenticated;