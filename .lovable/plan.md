## Objetivo

Permitir editar registos de `movimentacoes` a partir do histórico, com página dedicada `/movimentacao/historico/$id/editar`, acesso a admins e vendedores, soft delete e ressync GHL.

## Modelo de acesso

- **Admin**: edita/apaga/ressincroniza qualquer registo.
- **Vendedor**: edita/apaga/ressincroniza apenas registos onde `recebido_por_slug` (ou coluna equivalente já existente que identifica o vendedor/recebedor do link) corresponde ao seller do utilizador.
- Página pública `/movimentacao/historico` continua em leitura anónima; botão "Editar" aparece condicionalmente quando há sessão autenticada com permissão.

## Base de dados

Migração:
- Adicionar `deleted_at timestamptz` a `movimentacoes` (soft delete).
- Adicionar `updated_at timestamptz` + trigger se ainda não existir.
- Ajustar policy pública `SELECT anon` para filtrar `deleted_at IS NULL`.
- Nova policy `UPDATE` para `authenticated`: admin (via `has_role`) OU vendedor dono (comparando `recebido_por_slug` com o slug do seller). Idem policy leitura autenticada dos próprios registos (mesmo se soft-deleted, para a UI mostrar histórico).
- View / RPC opcional `movimentacoes_stats` já mencionada anteriormente — reaproveitar.

## Server functions (`src/lib/movimentacao.functions.ts`)

Todas com `.middleware([requireSupabaseAuth])`:

1. `getMovimentacaoForEdit({ id })` — devolve o registo + flag `canEdit` calculada no servidor a partir do role/seller.
2. `updateMovimentacao({ id, patch })` — valida com Zod:
   - `nome_cliente` (string 1..120)
   - `artist_id` (uuid | null)
   - `tipo_movimento` (enum)
   - `valor_cartao/dinheiro/sumup/transferencia` (number ≥ 0)
   - Recalcula `total` no servidor (soma dos 4). Ignora `total` vindo do cliente.
   - Reautoriza (admin OU dono) antes do UPDATE; RLS é rede de segurança.
   - Marca `ghl_sync_status = 'pending'` para reenviar (opcional, ver ação abaixo).
3. `softDeleteMovimentacao({ id })` — set `deleted_at = now()`.
4. `resyncMovimentacaoGhl({ id })` — dispara sync usando o helper existente em `movimentacao-ghl.server.ts`.

Listagem pública existente (`listMovimentacoesHistorico`) passa a filtrar `deleted_at IS NULL` (já fica coberto pela policy anon).

## UI

### Card no histórico
- Se utilizador autenticado com permissão sobre a linha: renderizar botão discreto "Editar" (ícone lápis) que faz `<Link to="/movimentacao/historico/$id/editar" params={{ id }}>`.
- Detecção do estado auth: hook `useCurrentUser` já existente; a decisão fina (dono/admin) fica no servidor via `canEdit` retornado por uma versão leve — para não pedir por linha, o `listMovimentacoesHistorico`, quando chamado autenticado, devolve `canEdit` por row. Chamado anónimo, devolve `canEdit: false`.

### Página `/movimentacao/historico/$id/editar`
Rota autenticada em `src/routes/_authenticated/movimentacao.historico.$id.editar.tsx` (bloqueia anónimos naturalmente pelo gate `_authenticated`).

Layout mobile-first:
- Header sticky com "← Voltar" (volta ao histórico preservando `?highlight=<id>`).
- Form com campos: Nome do cliente, Tatuador (Select com artistas ativos), Tipo (Select), Valores por método (4 inputs numéricos com máscara EUR), Total (readonly, calculado ao vivo).
- Rodapé sticky com "Guardar alterações" (primary) e menu "Mais" com "Apagar" (confirm) e "Ressincronizar GHL".
- Estados: loading, saving, success toast + navigate para `/movimentacao/historico?highlight=<id>`, erro inline.
- Guard: se `canEdit=false`, mostra estado "Sem permissão".

### React Query
- `useMutation` para update/delete/resync, invalidar `["movimentacao-historico"]` e a query do detalhe no `onSuccess`.

## Segurança

- Autorização dupla: server function verifica role/ownership antes do UPDATE; policies RLS impedem escrita fora do escopo.
- Nunca confiar em `total` do cliente — recalcular no servidor.
- Zod em todos os inputs; limites de tamanho.
- `deleted_at` esconde da vista pública; admin pode ver soft-deletes se quisermos (fora do escopo agora).

## Ficheiros a criar/editar

- **Migração SQL**: `deleted_at`, policies UPDATE + SELECT autenticado, atualização da policy anon.
- `src/lib/movimentacao.functions.ts`: novas fns + `canEdit` no list.
- `src/routes/_authenticated/movimentacao.historico.$id.editar.tsx`: nova rota.
- `src/routes/movimentacao.historico.tsx`: mostrar botão "Editar" por card quando `canEdit`.
- (Opcional) `src/lib/movimentacao-ghl.server.ts`: expor helper `resyncOne(id)` se ainda não existe standalone.

## Fora do escopo

- Auditoria/histórico de alterações (log de quem editou o quê).
- Edição em massa.
- Restaurar soft-deletes na UI.
