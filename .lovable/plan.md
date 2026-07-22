## Plano — Financeiro pronto para uso real

Respostas confirmadas:
- Gabriel: slug resolve para **ffmconsultoria@gmail.com** (admin master)
- Augusto: **apagar** app_user do Felipe (`felipe@gftattoo.org`)
- Link público: **URL simples** (`/movimentacao/gabriel`) — sem autenticação
- Nivia: criar seller + convite, comissão padrão

---

### 1. Consolidar identidades (migration SQL)

- Apagar `app_users` do Felipe (`e963938e…`), liberando o `artist_id` do Augusto para vincular à conta correta (`araujoaugusto499@gmail.com`).
- Garantir que `ffmconsultoria@gmail.com` seja o único `app_user` com `role='admin'` vinculado ao `artist_id` do Gabriel Fernandes. Contas `contatodegabriel@gmail.com` e `gabriel@gftattoo.test`: desvincular `artist_id` (mantém login, mas não resolve mais o slug).
- Idem para Augusto: garantir `araujoaugusto499` como único `app_user` com `artist_id` do Augusto.

### 2. Ajustar `resolveSlugOwner`

- Trocar heurística "artist mais antigo" por regra determinística: para cada slug, escolher o `app_user` com `artist_id` correspondente. Após passo 1, restará apenas um.
- Para `nivia`: escolher `app_user` com `seller_id` correspondente.

### 3. Tornar `/movimentacao/$slug` público

- Rota fica fora de `_authenticated/`. Já está em `src/routes/movimentacao.$slug.tsx` — confirmar que não usa `requireSupabaseAuth` em nenhum server fn crítico do submit.
- Converter `submitMovimentacao` (ou equivalente em `movimentacao.functions.ts`) para **server function pública** (sem `requireSupabaseAuth`):
  - Validar slug via `resolveSlugOwner` server-side.
  - Gravar `recebido_por_app_user_id` a partir do slug, nunca do cliente.
  - Usar `supabaseAdmin` (carregado dinamicamente dentro do handler) para o INSERT em `movimentacoes`, respeitando `chave_idempotencia`.
  - Rate limiting simples por slug+IP (ex.: 20/min) — opcional se a URL já for compartilhada só com clientes.
- RLS em `movimentacoes`: adicionar policy `INSERT` para role `anon` restrita ao caminho via server fn (o INSERT via `supabaseAdmin` bypassa RLS, então basta manter policies restritas para SELECT/UPDATE de authenticated).

### 4. Uma linha por forma de pagamento

- Ajustar formulário e handler: quando pagamento é misto, criar N rows em `movimentacoes`, uma por forma. `chave_idempotencia` = `${slug}:${appointment_or_contact}:${forma}:${timestamp_bucket}`.

### 5. Convidar Nivia como seller

- Inserir row em `sellers` (nome "Nivia Mendes", GHL user `1PN6UERcCHqwhFpY8RLD`, telefone, comissão padrão).
- Reusar `sendSellerInvite` (equivalente ao de artistas) para `niviamendx@gmail.com`.
- No callback do invite, criar `app_users(role='seller', seller_id=<nivia>)`.

### 6. GHL — aceitar movimentação sem Contact vinculado

- Confirmado: aceitável. Manter tentativa de match por telefone/email; se não achar Contact, gravar `ghl_contact_id = NULL` e não bloquear submit.
- Escopo `objects.write` do `GHL_TOKEN` confirmado — Custom Object continua sendo escrito.

### 7. Retirar dependência de login do PaymentLinkCard

- No `Menu` e `Onboarding.bem-vindo`, o card mostra link público sem exigir sessão para abrir. Nada muda no card em si; muda a rota destino.

### 8. Verificação final

- Testar `/movimentacao/gabriel`, `/andre`, `/joyce`, `/augusto`, `/nivia` em janela anônima.
- Confirmar que submit grava em `movimentacoes` com `recebido_por_app_user_id` = conta correta (Gabriel → ffmconsultoria; Augusto → araujoaugusto499).
- Confirmar sync GHL para Custom Object.

---

### Detalhes técnicos

- **Migrations**: 1 migration para (a) DELETE `app_users` do Felipe, (b) UPDATE `app_users` desvinculando `artist_id` das contas de teste do Gabriel, (c) INSERT em `sellers` para Nivia.
- **Server fn pública de submit**: sem `requireSupabaseAuth`; usa `supabaseAdmin` via `await import("@/integrations/supabase/client.server")` dentro do handler; valida slug e monta payload server-side.
- **Convite Nivia**: executado via server fn admin existente (`sellers-invite.functions.ts`) após a migration.
- Não mexer em `ghl-proxy` nem nos hooks de cron nesta fase (findings de segurança separados).

Resposta ao "processo está pronto?": **Ainda NÃO** — ficará pronto ao completar passos 1–5.