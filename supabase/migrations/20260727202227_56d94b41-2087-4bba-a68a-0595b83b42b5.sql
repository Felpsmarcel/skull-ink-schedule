ALTER TABLE public.movimentacoes
  ADD COLUMN IF NOT EXISTS registrado_por_nome text,
  ADD COLUMN IF NOT EXISTS registrado_por_staff_id text,
  ADD COLUMN IF NOT EXISTS registrado_user_agent text,
  ADD COLUMN IF NOT EXISTS registrado_ip_hash text,
  ADD COLUMN IF NOT EXISTS registrado_em timestamptz;

CREATE TABLE IF NOT EXISTS public.movimentacoes_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimentacao_id uuid NOT NULL,
  acao text NOT NULL,
  actor_app_user_id uuid,
  actor_nome text,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS movimentacoes_audit_mov_idx
  ON public.movimentacoes_audit (movimentacao_id, created_at DESC);

GRANT SELECT ON public.movimentacoes_audit TO authenticated;
GRANT ALL ON public.movimentacoes_audit TO service_role;

ALTER TABLE public.movimentacoes_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_authenticated" ON public.movimentacoes_audit;
CREATE POLICY "audit_select_authenticated"
  ON public.movimentacoes_audit FOR SELECT TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.movimentacoes_audit_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes jsonb := '{}'::jsonb;
  v_acao text;
  v_actor uuid := auth.uid();
  v_nome text;
  k text;
  v_old jsonb;
  v_new jsonb;
  v_tracked text[] := ARRAY[
    'nome_cliente','data_pagamento','artist_id','recebido_por_app_user_id',
    'tipo_movimento','forma_pagamento','valor_cartao','valor_dinheiro',
    'valor_sumup','valor_transferencia','total','data_tatuagem','observacoes',
    'ghl_sync_status','deleted_at','link_origem','origem_lancamento'
  ];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao := 'criado';
    v_nome := NEW.registrado_por_nome;
    v_changes := jsonb_build_object(
      'nome_cliente', NEW.nome_cliente,
      'total', NEW.total,
      'tipo_movimento', NEW.tipo_movimento::text,
      'link_origem', NEW.link_origem
    );
    INSERT INTO public.movimentacoes_audit (movimentacao_id, acao, actor_app_user_id, actor_nome, changes)
    VALUES (NEW.id, v_acao, COALESCE(v_actor, NEW.registrado_por_app_user_id), v_nome, v_changes);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.movimentacoes_audit (movimentacao_id, acao, actor_app_user_id, actor_nome, changes)
    VALUES (OLD.id, 'removido', v_actor, NULL, jsonb_build_object('nome_cliente', OLD.nome_cliente, 'total', OLD.total));
    RETURN OLD;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  FOREACH k IN ARRAY v_tracked LOOP
    IF (v_old -> k) IS DISTINCT FROM (v_new -> k) THEN
      v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('de', v_old -> k, 'para', v_new -> k));
    END IF;
  END LOOP;

  IF v_changes = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    v_acao := 'apagado';
  ELSIF v_changes ? 'ghl_sync_status' AND (SELECT count(*) FROM jsonb_object_keys(v_changes)) = 1 THEN
    v_acao := 'resync';
  ELSE
    v_acao := 'editado';
  END IF;

  INSERT INTO public.movimentacoes_audit (movimentacao_id, acao, actor_app_user_id, actor_nome, changes)
  VALUES (NEW.id, v_acao, v_actor, NULL, v_changes);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS movimentacoes_audit ON public.movimentacoes;
CREATE TRIGGER movimentacoes_audit
AFTER INSERT OR UPDATE OR DELETE ON public.movimentacoes
FOR EACH ROW EXECUTE FUNCTION public.movimentacoes_audit_trg();

DROP FUNCTION IF EXISTS public.get_movimentacoes_report(timestamp with time zone,timestamp with time zone,uuid,text,uuid,text,text);

CREATE FUNCTION public.get_movimentacoes_report(
  p_start timestamp with time zone,
  p_end timestamp with time zone,
  p_artist uuid DEFAULT NULL::uuid,
  p_tipo text DEFAULT NULL::text,
  p_recebedor uuid DEFAULT NULL::uuid,
  p_sync_status text DEFAULT NULL::text,
  p_origem text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid, created_at timestamptz, data_pagamento date, nome_cliente text,
  artist_id uuid, tatuador text, recebido_por_app_user_id uuid, recebido_por_nome text,
  registrado_por_nome text,
  link_origem text, tipo_movimento text, valor_cartao numeric, valor_dinheiro numeric,
  valor_sumup numeric, valor_transferencia numeric, total numeric, ghl_sync_status text
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
    COALESCE(ra.name, rs.name, m.recebido_por_app_user_id::text) AS recebido_por_nome,
    m.registrado_por_nome,
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
  LEFT JOIN public.artists ra ON ra.id = u.artist_id
  LEFT JOIN public.sellers rs ON rs.id = u.seller_id
  WHERE m.deleted_at IS NULL
    AND m.data_pagamento >= p_start::date
    AND m.data_pagamento <= p_end::date
    AND (v_role = 'admin'::user_role OR m.recebido_por_app_user_id = v_uid)
    AND (p_artist IS NULL OR m.artist_id = p_artist)
    AND (p_tipo IS NULL OR m.tipo_movimento::text = p_tipo)
    AND (p_recebedor IS NULL OR m.recebido_por_app_user_id = p_recebedor)
    AND (p_sync_status IS NULL OR m.ghl_sync_status::text = p_sync_status)
    AND (p_origem IS NULL OR m.origem_lancamento = p_origem)
  ORDER BY m.data_pagamento DESC, m.created_at DESC;
END;
$function$;