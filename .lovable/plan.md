## Objetivo

Criar uma página admin dedicada que mostre o status de vínculo (`app_users → artist_id`) apenas dos artistas usados em `/movimentacao/{slug}` (Gabriel, Andre, Joyce, Augusto) — mais Nívia (seller). Cada linha indica se o link funciona ou não e oferece um botão rápido para convidar/reparar.

A página `/admin/equipe` atual já convida qualquer artista, mas mistura toda a equipe e não deixa óbvio quais slugs de `/movimentacao` estão quebrados. Esta nova tela é focada nesse contrato.

## O que fazer

### 1. Nova server function — `getMovimentacaoLinkStatus`
Arquivo: `src/lib/movimentacao-links.functions.ts` (novo).

- `createServerFn` com `requireSupabaseAuth` + `assertAdmin` (mesmo padrão de `team.functions.ts`).
- Itera `MOVIMENTACAO_SLUGS` de `src/config/movimentacao-slugs.ts`.
- Para cada slug:
  - Se `kind === "artist"`: busca `artists` pelo id + `app_users` onde `artist_id = id AND role = 'artist'`.
  - Se `kind === "seller"`: busca `sellers` pelo id + `app_users` onde `seller_id = id AND role = 'seller'`.
  - Resolve email de cada user via `supabaseAdmin.auth.admin.listUsers` (reusar helper do `team.functions.ts`).
- Retorna `Array<{ slug, kind, targetId, displayName, exists, active, linkedUsers: [{id,email}], ready: boolean }>` onde `ready = exists && active && linkedUsers.length > 0`.

### 2. Nova rota — `/admin/movimentacao-links`
Arquivo: `src/routes/_authenticated/_admin/admin.movimentacao-links.tsx` (novo).

Layout mobile-first, lista de cards um por slug com:
- Nome, slug, badge de status (`pronto` verde / `sem usuário` amarelo / `inativo` ou `sem cadastro` vermelho).
- URL prevista (`/movimentacao/{slug}`) com botão de copiar.
- Se `linkedUsers.length === 0`: input de email + botão "Convidar" que chama `inviteArtist` (artist) ou `inviteSeller` (seller — reusar `sellers-invite.functions.ts`).
- Se já vinculado: mostra emails vinculados + botão "Reenviar convite" e "Reparar vínculo" (reusa `repairArtistLink`/equivalente de seller).
- Um resumo no topo: "3 de 5 links prontos".

Invalida `["movimentacao-links"]`, `["team"]`, `["sellers"]` no sucesso.

### 3. Atalho no menu admin
Arquivo: `src/routes/_authenticated/menu.tsx`.

Adicionar uma linha na seção admin: `Links de pagamento` → `/admin/movimentacao-links` (ícone `Link2`), logo abaixo de "Vendedores".

## O que NÃO fazer

- Não mexer em `team.functions.ts` nem `sellers-invite.functions.ts` — apenas consumir.
- Não duplicar o fluxo de convite; reusar as mutations existentes.
- Sem mudanças de banco/RLS.

## Detalhes técnicos

- Reuso de `findAuthUserByEmail` de `team.functions.ts`: como está privado, extrair para `src/lib/auth-lookup.server.ts` OU inline-mente uma cópia mínima na nova server fn (paginação `listUsers` já é conhecida). Prefiro extração para evitar drift.
- A checagem `sellers-invite.functions.ts` já existe (usada por `/admin/vendedores`) — importar `inviteSeller` diretamente.
- Query React: `useQuery({ queryKey: ["movimentacao-links"], queryFn: getStatus })` com `staleTime: 30_000`.
