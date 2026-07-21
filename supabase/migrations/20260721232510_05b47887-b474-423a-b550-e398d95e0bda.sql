
-- 1) Permitir movimentações sem usuário logado (rota pública)
ALTER TABLE public.movimentacoes
  ALTER COLUMN registrado_por_app_user_id DROP NOT NULL;

-- 2) Adicionar coluna forma_pagamento (uma linha por forma de pagamento)
DO $$ BEGIN
  CREATE TYPE public.forma_pagamento_enum AS ENUM ('cartao','dinheiro','sumup','transferencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.movimentacoes
  ADD COLUMN IF NOT EXISTS forma_pagamento public.forma_pagamento_enum;

-- Backfill: para linhas antigas (nenhuma hoje) derivar do maior valor
UPDATE public.movimentacoes
SET forma_pagamento = CASE
  WHEN valor_cartao       >= GREATEST(valor_dinheiro, valor_sumup, valor_transferencia) AND valor_cartao       > 0 THEN 'cartao'
  WHEN valor_dinheiro     >= GREATEST(valor_cartao,   valor_sumup, valor_transferencia) AND valor_dinheiro     > 0 THEN 'dinheiro'
  WHEN valor_sumup        >= GREATEST(valor_cartao,   valor_dinheiro, valor_transferencia) AND valor_sumup    > 0 THEN 'sumup'
  WHEN valor_transferencia > 0 THEN 'transferencia'
  ELSE NULL
END::public.forma_pagamento_enum
WHERE forma_pagamento IS NULL;

-- 3) Substituir UNIQUE(chave_idempotencia) por UNIQUE(chave_idempotencia, forma_pagamento)
ALTER TABLE public.movimentacoes
  DROP CONSTRAINT IF EXISTS movimentacoes_chave_idempotencia_key;

CREATE UNIQUE INDEX IF NOT EXISTS movimentacoes_chave_forma_key
  ON public.movimentacoes (chave_idempotencia, forma_pagamento);

-- 4) Coluna para agrupar linhas do mesmo submit (mesmo formulário, N formas)
ALTER TABLE public.movimentacoes
  ADD COLUMN IF NOT EXISTS chave_grupo uuid;

CREATE INDEX IF NOT EXISTS idx_movimentacoes_grupo
  ON public.movimentacoes (chave_grupo);

-- 5) Grant explícito ao service_role (rota pública usa supabaseAdmin)
GRANT ALL ON public.movimentacoes TO service_role;
