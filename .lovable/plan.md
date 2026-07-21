## Objetivo

Adicionar uma ação "Reprocessar sync HighLevel" na página `/admin/movimentacao-links` que reexecuta a sincronização com o HighLevel **apenas** para registros de `movimentacoes` com `ghl_sync_status = 'failed'`.

## Escopo

Reprocessamento restrito a linhas com `ghl_sync_status = 'failed'`. Nada em `pending` ou `synced` é tocado. Não altera o link de convite/vínculo do artista — é uma ação separada da seção "Convidar/Reparar".

## Implementação

### 1. Nova server function — `src/lib/movimentacao.functions.ts`

Adicionar `reprocessFailedMovimentacoes` (admin-only, POST, protegida por `requireSupabaseAuth` + verificação `role === 'admin'` via `context.supabase` em `app_users`).

Comportamento:
- Aceita input opcional `{ slug?: MovimentacaoSlug, limit?: number (default 20, max 50) }`. Sem `slug`, processa todos os slugs; com `slug`, filtra por `link_origem = slug`.
- Carrega até `limit` linhas com `ghl_sync_status = 'failed'` via `supabaseAdmin`, ordenadas por `created_at asc` (mais antigas primeiro).
- Para cada linha: resolve `artist.name` e `recebido_por` (via `resolveSlugOwner(link_origem)`), chama `syncMovimentacaoToGhl` reutilizando o payload atual, e:
  - Se `ok`: update para `synced`, `ghl_custom_object_id`, `ghl_last_synced_at = now()`, `ghl_sync_attempts = ghl_sync_attempts + 1`, `ghl_sync_error = null`.
  - Se erro: mantém `failed`, incrementa `ghl_sync_attempts`, atualiza `ghl_sync_error` (500 chars) e `ghl_last_synced_at`.
- Retorna `{ processed, succeeded, failed, errors: Array<{ id, error }> }`.

Idempotência preservada — `syncMovimentacaoToGhl` já usa `externalId = chave_idempotencia`, então se o record foi criado no GHL numa tentativa anterior, o HighLevel dedupa; qualquer erro 4xx específico de duplicata volta como `ok:false` e será tratado (pode-se detectar `status=409` ou mensagem "already exists" e marcar como `synced` — ver Detalhes técnicos).

### 2. Contagem de failures — `src/lib/movimentacao-links.functions.ts`

Estender `MovimentacaoLinkStatus` com `failedSyncCount: number`. No handler, agregar via `supabaseAdmin` um `count` por `link_origem` onde `ghl_sync_status = 'failed'` e adicionar ao retorno por slug.

### 3. UI — `src/routes/_authenticated/_admin/admin.movimentacao-links.tsx`

Dentro de `LinkCard`, quando `row.failedSyncCount > 0`:
- Exibir `StatusBadge variant="warning"`: `N falha(s) sync GHL`.
- Botão "Reprocessar sync" (ícone `RefreshCw`), abaixo da seção convite/reparar, chamando `reprocessFailedMovimentacoes({ slug: row.slug })` via `useServerFn` + `useMutation`.
- `onSuccess`: toast com `succeeded/processed`; invalidar `["movimentacao-links"]`.
- `onError`: toast de erro.

Também adicionar no cabeçalho um botão global "Reprocessar todas as falhas" quando `sum(failedSyncCount) > 0`, chamando a mesma função sem `slug`.

## Detalhes técnicos

- **Duplicatas no GHL**: se o record já foi criado numa tentativa anterior (record existe com o mesmo `externalId`), o POST retorna 4xx. Tratar no `reprocessFailedMovimentacoes` inspecionando o `sync.error` retornado — se contiver `status=409` ou `"already exists"`/`"duplicate"`, marcar como `synced` sem `ghl_custom_object_id` (será resolvido em sync futuro por GET, fora deste escopo).
- **Autorização**: usar o padrão já presente em `ghl-sync-admin.functions.ts` (checar role via `context.supabase` antes de importar `supabaseAdmin`). Não fazer fallback para admin client na verificação de role.
- **Rate limit**: processar sequencialmente (não `Promise.all`) para não estourar rate limit do HighLevel; com `limit ≤ 50` isso é rápido o bastante.
- **Colunas usadas**: `ghl_sync_status`, `ghl_sync_attempts`, `ghl_sync_error`, `ghl_last_synced_at`, `ghl_custom_object_id` já existem na tabela `movimentacoes` (usadas em `createMovimentacao`).
- **Sem migração** — apenas código de aplicação.
- **TS**: rodar `tsgo` ao final para garantir zero erros.
