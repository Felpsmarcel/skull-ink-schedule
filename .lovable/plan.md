## Auditoria (o que já existe)

- **Auth**: Supabase; `requireSupabaseAuth` injeta `supabase`, `userId` no server. `app_users(id → auth.uid)` liga `role` (`admin`/`artist`/`seller`) + `artist_id` + `seller_id`.
- **Artistas** (`artists`): Gabriel Fernandes, Andre Pareyn, Joyce Cavalcante, Augusto Santos (mapeado para slug `augusto`), + Neto Mendes e outros.
- **Nivia**: existe em `sellers` (com acento — "Nívia"), **sem `app_users**`. Precisa de convite para logar.
- **HighLevel**: só via edge function `ghl-proxy` (calendários/contatos/agendamentos). Não há Custom Object hoje.
- **Financeiro atual**: tabela `payments` (comissão de agendamentos) + `/financeiro`. Não será alterada.
- **Sidebar mobile**: `BottomNav` (Agenda / Financeiro / + / Perfil). Menu completo em `/menu`.

## Arquivos criados / alterados

**Novos**

- `src/routes/_authenticated/movimentacao.index.tsx` — redireciona autenticado → seu slug.
- `src/routes/_authenticated/movimentacao.$slug.tsx` — página do formulário.
- `src/components/movimentacao/movimentacao-form.tsx` — formulário mobile-first.
- `src/hooks/use-movimentacao.ts` — mutation + toast + reset.
- `src/lib/movimentacao.functions.ts` — server fns `createMovimentacao`, `listMovimentacoes`.
- `src/lib/movimentacao-ghl.server.ts` — cria Custom Object + sync (fora do bundle client).
- Migração Supabase (tabela + RLS + índices).

**Alterados**

- `src/routes/_authenticated/menu.tsx` — item "Registrar pagamento".
- `src/components/layout/bottom-nav.tsx` — troca "+" central por atalho ao slug do usuário (mantém "novo agendamento" acessível pelo menu).
- `src/routes/_authenticated/financeiro.tsx` — nova aba/filtro "Movimentações" (admin vê tudo, artist/seller vê o próprio).
- `src/i18n/locales/pt.json` (+ en/fr) — labels.

Nenhum arquivo/tabela existente é apagado ou sobrescrito.

## Modelo de dados

Migração cria `public.movimentacoes` (nova, isolada de `payments`):

- `id uuid pk`
- `nome_cliente text not null`
- `data_pagamento date not null` (Europe/Brussels)
- `artist_id uuid → artists(id)` **tatuador** (dono financeiro)
- `recebido_por_app_user_id uuid → app_users(id)` **quem recebeu** (dono do link)
- `registrado_por_app_user_id uuid → app_users(id)` **quem submeteu** (`auth.uid`)
- `link_origem text` (`gabriel|andre|joyce|augusto|nivia`)
- `origem_lancamento text default 'link_individual'`
- `tipo_movimento` enum (`sinal|sessao|saldo|produto|estorno`)
- `valor_cartao|valor_dinheiro|valor_sumup|valor_transferencia numeric(10,2) default 0` (≥0)
- `total numeric(10,2) generated always as (soma) stored`
- `data_tatuagem date null`
- `observacoes text null`
- `chave_idempotencia text unique not null`
- `ghl_custom_object_id text null`, `ghl_sync_status text` (`pending|synced|failed`), `ghl_sync_error text`, `ghl_sync_attempts int`
- `created_at`, `updated_at`

**Constraints**: `check ((valor_cartao=0) or (valor_sumup=0))`; `check (total > 0)`.

**RLS**

- Admin: tudo.
- Autenticado: `SELECT` das próprias linhas (`registrado_por_app_user_id = auth.uid()` ou `recebido_por_app_user_id = auth.uid()` ou artist_id linkado).
- `INSERT`: só via server fn (registrado_por = `auth.uid`).

## Mapa slug → identidade

Constante em `src/config/movimentacao-slugs.ts`:

```text
gabriel  → artist  Gabriel Fernandes  (artist_id fixo)
andre    → artist  Andre Pareyn
joyce    → artist  Joyce Cavalcante
augusto  → artist  Augusto Santos     (mesma pessoa; label pt "Augusto")
nivia    → seller  Nívia              (não é tatuadora — não aparece no select "Tatuador")
```

## Segurança do link

Rotas ficam sob `_authenticated/` (login obrigatório). No server fn `createMovimentacao`:

1. Valida bearer (`requireSupabaseAuth`).
2. Resolve `recebido_por_app_user_id` a partir do slug:
  - Slugs de artista → `app_users.artist_id = ARTIST_ID_DO_SLUG`.
  - Slug `nivia` → `app_users.seller_id = SELLER_ID_DA_NIVIA`.
3. Se `auth.uid` ≠ dono do slug e role ≠ `admin` → 403 (e o loader redireciona para o slug correto).
4. `registrado_por_app_user_id = auth.uid` (nunca vem do cliente).

Admin pode acessar qualquer slug (para suporte). Ninguém consegue "virar Nivia" pela URL.

**Nivia precisa de conta**: se `app_users` da Nivia ainda não existir, envio o convite pelo fluxo já usado em `/admin/equipe` (não faz parte deste plano de código — anoto na entrega).

## UX do formulário (mobile-first)

Header: **"Registro de pagamento — {Nome}"** (do slug).

Campos na ordem do brief. Total é read-only, destaque em `#E11D2A` texto grande. Se `tipo_movimento = sinal`, "Data da sessão agendada" ganha borda de destaque e helper visível. "Recebido por" é read-only sempre. Select "Tatuador":

- Link de artista: pré-selecionado com o próprio, editável (pode receber para outro).
- Link da Nivia: vazio, obrigatório.
- Opções: só artistas ativos, exceto os 2 calendários "GF TATTOO (Tattoo/Randevu)".

Validações client + server idênticas (Zod). Idempotência: UUID gerado no client, enviado no payload; server `insert` com `on conflict (chave_idempotencia) do nothing returning *`.

Botão: `A registar…` + spinner, desabilita durante submit. Sucesso: toast verde + reset preservando slug/tatuador padrão/data hoje + botão "Registrar outro pagamento".

## Sincronização HighLevel (Custom Object)

Em `movimentacao-ghl.server.ts` (só server):

1. **Bootstrap idempotente** — no primeiro `createMovimentacao` (ou via job admin one-off em `/admin`), chama `POST /objects/schemas` (v2021-07-28) via `ghl-proxy` criando `custom_objects.movimentacao_financeira` com todos os campos (mesmos nomes do payload). Se retorno for 409/duplicate, ignora. A chave é cacheada em uma linha `settings` no Supabase (`ghl_movimentacao_object_key`) para evitar recriar.
2. Após o INSERT no Supabase, chama `POST /objects/{objectKey}/records` com o payload completo. Guarda `id` em `ghl_custom_object_id`, marca `synced`.
3. Se falhar: `ghl_sync_status = 'failed'`, salva `ghl_sync_error`, incrementa `ghl_sync_attempts`. **A movimentação já está salva no Supabase** — sync GHL pode ser reprocessada por um botão admin em `/admin` (fase próxima) sem duplicar (usa `chave_idempotencia` como `externalId` no HL).

Nenhuma credencial GHL sai do backend (o `ghl-proxy` já usa `GHL_TOKEN` do secret).

## Fluxo de submissão

```text
Client → serverFn createMovimentacao (bearer)
  ├─ requireSupabaseAuth → userId
  ├─ resolve slug → recebido_por + valida auth.uid == dono | admin
  ├─ Zod: campos + total>0 + exclusividade cartão/sumup
  ├─ Insert em movimentacoes (unique chave_idempotencia)
  ├─ Best-effort: sync GHL Custom Object
  └─ return { id, ghl_sync_status }
```

## Aparecer no financeiro / filtros

Nova aba/filtro "Movimentações" em `/financeiro`:

- **Admin**: todas; filtros tatuador, recebido por, data, tipo, forma de pagamento.
- **Artist**: só onde `artist_id = current_artist_id()`.
- **Seller (Nivia)**: só onde `recebido_por_app_user_id = auth.uid()`.

Nenhuma alteração na parte de comissões de agendamentos.

## Links finais

```text
https://gftattoocalendar.com/movimentacao/gabriel
https://gftattoocalendar.com/movimentacao/andre
https://gftattoocalendar.com/movimentacao/joyce
https://gftattoocalendar.com/movimentacao/augusto
https://gftattoocalendar.com/movimentacao/nivia
```

Redirecionamento: `/movimentacao` → slug do usuário logado (ou `/agenda` se não tiver mapeamento).

## Testes de aceite

1. Nivia (logada) abre `/movimentacao/nivia`: "Recebido por: Nivia" bloqueado, tatuador vazio obrigatório.
2. Nivia abre `/movimentacao/gabriel` → server rejeita e redireciona a `/movimentacao/nivia`.
3. Link do Gabriel: tatuador pré = Gabriel, editável.
4. Cartão + SumUp simultâneos → erro "SumUp e Cartão são métodos exclusivos".
5. Total 0 → erro "O total deve ser superior a €0."
6. Duplo clique → uma única linha (unique key na `chave_idempotencia`).
7. Erro do GHL não bloqueia insert; fica `ghl_sync_status=failed`.
8. Registro aparece em `/financeiro` para o tatuador dono e para o admin.

## Pendências fora deste plano

- Convite/onboarding da Nivia (uso o fluxo `/admin/equipe` existente — não é código novo).
- Reprocessamento de falhas GHL em massa (fica para uma tela admin depois; base já grava `ghl_sync_attempts` e `chave_idempotencia`).  
  
analise essas mudanças antes de criar.  
