-- Enum for tipo_movimento
DO $$ BEGIN
  CREATE TYPE public.movimentacao_tipo AS ENUM ('sinal','sessao','saldo','produto','estorno');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enum for sync status
DO $$ BEGIN
  CREATE TYPE public.movimentacao_sync_status AS ENUM ('pending','synced','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Settings table (simple key/value) for GHL custom object key cache
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "app_settings_admin_all" ON public.app_settings
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin'::user_role)
    WITH CHECK (public.current_user_role() = 'admin'::user_role);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main table
CREATE TABLE public.movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_cliente text NOT NULL,
  data_pagamento date NOT NULL,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE RESTRICT,
  recebido_por_app_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  registrado_por_app_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  link_origem text NOT NULL,
  origem_lancamento text NOT NULL DEFAULT 'link_individual',
  tipo_movimento public.movimentacao_tipo NOT NULL,
  valor_cartao numeric(10,2) NOT NULL DEFAULT 0 CHECK (valor_cartao >= 0),
  valor_dinheiro numeric(10,2) NOT NULL DEFAULT 0 CHECK (valor_dinheiro >= 0),
  valor_sumup numeric(10,2) NOT NULL DEFAULT 0 CHECK (valor_sumup >= 0),
  valor_transferencia numeric(10,2) NOT NULL DEFAULT 0 CHECK (valor_transferencia >= 0),
  total numeric(10,2) GENERATED ALWAYS AS (valor_cartao + valor_dinheiro + valor_sumup + valor_transferencia) STORED,
  data_tatuagem date NULL,
  observacoes text NULL,
  chave_idempotencia text NOT NULL UNIQUE,
  referencia text NULL,
  ghl_contact_id text NULL,
  ghl_opportunity_id text NULL,
  ghl_custom_object_id text NULL,
  ghl_sync_status public.movimentacao_sync_status NOT NULL DEFAULT 'pending',
  ghl_sync_error text NULL,
  ghl_sync_attempts int NOT NULL DEFAULT 0,
  ghl_last_synced_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT movimentacoes_cartao_sumup_exclusivos CHECK (valor_cartao = 0 OR valor_sumup = 0),
  CONSTRAINT movimentacoes_total_positivo CHECK (
    (valor_cartao + valor_dinheiro + valor_sumup + valor_transferencia) > 0
  )
);

CREATE INDEX idx_movimentacoes_artist ON public.movimentacoes(artist_id);
CREATE INDEX idx_movimentacoes_recebido_por ON public.movimentacoes(recebido_por_app_user_id);
CREATE INDEX idx_movimentacoes_registrado_por ON public.movimentacoes(registrado_por_app_user_id);
CREATE INDEX idx_movimentacoes_data ON public.movimentacoes(data_pagamento DESC);
CREATE INDEX idx_movimentacoes_sync ON public.movimentacoes(ghl_sync_status) WHERE ghl_sync_status <> 'synced';

GRANT SELECT, INSERT, UPDATE ON public.movimentacoes TO authenticated;
GRANT ALL ON public.movimentacoes TO service_role;

ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "movimentacoes_admin_all" ON public.movimentacoes
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin'::user_role)
  WITH CHECK (public.current_user_role() = 'admin'::user_role);

-- Select: own records (as receiver, registrar, or artist)
CREATE POLICY "movimentacoes_own_select" ON public.movimentacoes
  FOR SELECT TO authenticated
  USING (
    recebido_por_app_user_id = auth.uid()
    OR registrado_por_app_user_id = auth.uid()
    OR artist_id = public.current_artist_id()
  );

-- Insert: registrado_por must be the caller
CREATE POLICY "movimentacoes_self_insert" ON public.movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (registrado_por_app_user_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER movimentacoes_set_updated_at
  BEFORE UPDATE ON public.movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
