## Correções Sprint MVP-1

### 1. Renomear rotas de auth para `/auth/recover` e `/auth/update-password`

Hoje existem `src/routes/auth_.reset.tsx` e `src/routes/auth_.update-password.tsx`. A convenção `auth_` (trailing underscore) já desanicha do layout `/auth`, então a URL correta é `/auth/reset` e `/auth/update-password`. Vou:

- Renomear `auth_.reset.tsx` → `auth_.recover.tsx` e ajustar `createFileRoute("/auth_/recover")`.
- Atualizar o link "Esqueci minha senha" em `src/routes/auth.tsx` para `to="/auth_/recover"`.
- `redirectTo` do `resetPasswordForEmail` passa a apontar para `/auth/update-password` (já é o comportamento atual).

Critério: `/auth`, `/auth/recover` e `/auth/update-password` renderizam telas distintas, sem sobreposição.

### 2. Callback real de invite/recovery em `/auth/update-password`

Hoje a página só faz `updateUser({ password })` e assume sessão pronta. Vou reescrever o fluxo de bootstrap:

- Ler `window.location` no mount e detectar em ordem:
  1. Query `?code=...` (PKCE) → `supabase.auth.exchangeCodeForSession(code)`.
  2. Query `?token_hash=...&type=invite|recovery` → `supabase.auth.verifyOtp({ token_hash, type })`.
  3. Hash `#access_token=...&refresh_token=...&type=...` (formato legacy) → `supabase.auth.setSession({ access_token, refresh_token })` e disparar `PASSWORD_RECOVERY`.
  4. Fallback: `getSession()` (caso o usuário já esteja logado).
- Estados de UI: `bootstrapping`, `ready`, `expired_or_invalid`, `no_link`.
- Erros mapeados: link expirado / token inválido / sessão ausente → mensagem amigável + botão "Solicitar novo link" que leva a `/auth/recover`.
- Só chama `updateUser({ password })` no estado `ready`. Só redireciona para `/agenda` **após** `updateUser` responder sucesso.
- Limpar `code` / `token_hash` da URL após consumir (`history.replaceState`) para permitir refresh sem reprocessar.

Critério: convidado abre link do email → define senha → entra. Recovery idem. Link expirado → erro claro com CTA.

### 3. Rota `/admin/equipe`

Renomear o arquivo para produzir literalmente `/admin/equipe`:

- Mover `src/routes/_authenticated/_admin/equipe.tsx` → `src/routes/_authenticated/_admin/admin.equipe.tsx` com `createFileRoute("/_authenticated/_admin/admin/equipe")`.
- Atualizar o link do menu (`src/routes/_authenticated/menu.tsx`) para `to="/admin/equipe"`.
- Gate admin continua herdado do layout `_admin/route.tsx`.

Critério: URL é `/admin/equipe`, não-admins recebem redirect/negação.

### 4. Onboarding real do artista

Ampliar `src/lib/team.functions.ts` e `admin.equipe.tsx`:

Nova server fn `upsertArtist` (admin only):
- Input: `{ id?: string, name, phone?, calendarId, ghlUserId?, commissionPct, active }`.
- Sem `id` → cria; com `id` → atualiza.
- Valida `calendarId` obrigatório quando `active=true` (senão o artista não aparece na agenda) — retorna erro validado.

Ampliar `inviteArtist`:
- Aceita `artistId` opcional; se ausente, exige campos do artista e cria antes de convidar (compondo com `upsertArtist`).
- Reenvio de convite: se já existe user linkado, envia `resend` (ou re-invite) sem quebrar.

UI em `admin.equipe.tsx`:
- Card por artista com botões: **Editar**, **Convidar / Reenviar convite**, **Vincular usuário existente por email**, **Ativar/Desativar**.
- Botão "Novo artista" abre form (Dialog) com nome, email opcional para convite imediato, telefone opcional, calendarId, ghlUserId, commissionPct, ativo.
- Badges de estado: `sem usuário`, `convite enviado`, `usuário vinculado`, `email divergente` (compara email do auth.users com email digitado no form quando disponível), `sem calendário GHL`.
- Loading e erro **por card** (mutation state local por artistId), não global.
- `Input` de email usa `type="email"` (já usa no form principal; garantir em todos os novos forms).

### 5. Invite idempotente + falha compensada

Refatorar `inviteArtist` para não deixar usuário órfão:

- Ordem nova: (a) upsert artist, (b) `app_users` upsert **antes** do invite quando possível — mas o `id` do auth só existe após o convite. Solução:
  1. Cria/resolve usuário via `inviteUserByEmail` (ou reaproveita existente).
  2. Tenta `app_users` upsert.
  3. Se upsert falhar: registrar em `ghl_sync_failures` (reuso da tabela existente com `context='invite_link'`) OU numa tabela dedicada mínima `invite_failures` (decido reusar `ghl_sync_failures` renomeando semanticamente via coluna `context`, para evitar migration nova).
  4. Retornar mensagem específica ao admin (`"Convite enviado mas vínculo falhou: <erro>. Clique em 'Reparar vínculo' no card."`).
- Novo endpoint `repairArtistLink({ artistId, email })`: procura usuário no auth pelo email e faz o `app_users` upsert. Aparece como botão no card quando o estado for `email divergente` ou `vínculo pendente`.
- Reenviar convite é idempotente: upsert em `app_users` roda de novo mesmo se já linkado.

Critério: admin sempre tem caminho de recuperação; nada fica invisível.

### 6. Endpoint `sync-ghl` — manter padrão apikey (documentado da Lovable)

Confirmado com o usuário: **manter `apikey`**. A doc oficial da Lovable diz para usar exatamente esse padrão em `/api/public/*` + pg_cron, e desaconselha inventar `CRON_SECRET`. Ações:

- Manter `src/routes/api/public/hooks/sync-ghl.ts` como está: valida `apikey` header contra `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY`, usa comparação simples (chave pública, não é segredo criptográfico), retorna 403 sem detalhes.
- Atualizar o comentário de topo do arquivo para deixar essa decisão explícita (evita a próxima revisão questionar de novo).
- **Não** criar `CRON_SECRET`. **Não** adicionar fallback de dev.

Critério: chamada sem header falha 403; com header correto executa sync.

### 7. Cron GHL — instalar de fato + runbook

O arquivo `20260701090000_setup_ghl_sync_cron.sql` mencionado no pedido **não existe** no repositório. Vou criar migration nova (data atual) que:

- `CREATE EXTENSION IF NOT EXISTS pg_cron; pg_net;`
- Cria função `public.schedule_ghl_sync()` (SECURITY DEFINER, admin-only via check `has_role`) que faz `cron.unschedule` (se existir) + `cron.schedule('ghl-sync-10min', '*/10 * * * *', $$ SELECT net.http_post(url:='https://project--03a6f57d-9b2a-4876-a3b5-a886d4f4b51d.lovable.app/api/public/hooks/sync-ghl', headers:=jsonb_build_object('apikey', <anon>, 'Content-Type','application/json'), body:='{}'::jsonb); $$)`.
- A anon key vai **do Vault** (`vault.decrypted_secrets`) sob o nome `ghl_sync_anon_key` — assim não fica em texto puro em `cron.job`. Migration insere no vault via `vault.create_secret` só se ainda não existir; valor real setado por script/admin.
- Função `public.unschedule_ghl_sync()` para desligar.
- Função `public.ghl_sync_status()` que retorna a linha de `cron.job` + últimas 5 execuções de `cron.job_run_details`, exposta como server fn `getGhlSyncStatus`.

Runbook curto adicionado em `docs/ghl-sync.md`:
1. Como popular o vault com a anon key.
2. Como rodar `SELECT public.schedule_ghl_sync();`.
3. Como verificar via UI admin (novo botão "Verificar cron" na tela `/admin/equipe` ou em `/admin/reconciliar`, mostrando o status retornado).

Critério: após deploy, admin roda a fn uma vez, cron passa a bater a cada 10min, status visível na UI.

### 8. UX da tela equipe

Aplicado junto do item 4:
- Loading e erro por card (mutation state por artistId).
- Mensagens de erro do Supabase mapeadas: `User already registered` → "Usuário já existe, vincule pelo botão 'Vincular usuário'".
- Validação: bloquear salvar `active=true` sem `calendarId` (mensagem inline).
- Badge amarela "sem calendário GHL" quando `calendar_id IS NULL`.
- Inputs de email com `type="email"` e `autoComplete="email"`.

---

## Arquivos afetados

- **Renomear**: `src/routes/auth_.reset.tsx` → `auth_.recover.tsx`; `_authenticated/_admin/equipe.tsx` → `_authenticated/_admin/admin.equipe.tsx`.
- **Editar**: `src/routes/auth.tsx` (link), `src/routes/auth_.update-password.tsx` (bootstrap PKCE/OTP), `src/lib/team.functions.ts` (upsertArtist, invite idempotente, repairArtistLink, listTeam expandido), `src/routes/_authenticated/_admin/admin.equipe.tsx` (nova UI), `src/routes/_authenticated/menu.tsx` (link `/admin/equipe`), `src/routes/api/public/hooks/sync-ghl.ts` (só comentário).
- **Criar**: migration `2026xxxx_ghl_sync_cron.sql` (schedule/unschedule/status via Vault), `docs/ghl-sync.md`, `src/lib/ghl-sync-admin.functions.ts` (server fns `scheduleGhlSync`, `unscheduleGhlSync`, `getGhlSyncStatus`).

## Não faz parte deste plano

- Criar `CRON_SECRET` (decidido manter apikey).
- Nova tabela `invite_failures` (reuso de `ghl_sync_failures`).
- Redesign de `/admin/reconciliar`.

Quando aprovar, executo em uma sequência: rotas de auth → equipe/onboarding → cron. Cada bloco fica testável isoladamente.