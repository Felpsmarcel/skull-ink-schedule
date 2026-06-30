## Sprint Sec-1: Auditoria + Fixes Críticos

### Minha recomendação para `seed-test-users`

**Deletar a rota inteira + remover `SEED_SECRET`.** Justificativa:
- Os usuários já estão criados e funcionando (`admin@gftattoo.test`, `gabriel@gftattoo.test`).
- A rota tem poder de **resetar senha de admin** — se `SEED_SECRET` vazar (chat, screenshot, log), é game over.
- Se precisar recriar usuários no futuro, é uma migration ou um script local com `service_role`, não uma rota pública.
- Reduz superfície de ataque a zero sem perda funcional.

Se um dia precisar de novos seeds, criar sob demanda e deletar depois.

---

### Fase 1 — Auditoria (read-only, gera relatório)

**1.1. Rotas públicas com side effects**
- Listar todos os arquivos em `src/routes/api/public/` e classificar por: tipo de auth, side effects, blast radius se abusada.
- Verificar `/lovable/email/queue/process`: confirmar que valida bearer service_role corretamente e não loga o token. **Não editar** (gerenciada por `setup_email_infra`).

**1.2. Import graph client/server**
- Buscar imports diretos de `@/integrations/supabase/client.server` fora de `*.server.ts`.
- Buscar leitura de `process.env.GHL_TOKEN`, `SERVICE_ROLE_KEY`, `SEED_SECRET` em arquivos que não são `.server.ts` nem `.handler()` body.
- Buscar uso de `supabaseAdmin` em `.functions.ts` no top-level (deveria ser dynamic import dentro do handler).

**1.3. Cron jobs**
- `SELECT * FROM cron.job` para confirmar quais estão ativos, frequência e URL alvo.
- Validar últimos `cron.job_run_details` do `sync-ghl-appointments` e `process-email-queue` (sucesso/falha).
- Conferir RLS em `ghl_sync_failures` (rota anônima escreve nela indiretamente).

**1.4. Security scan**
- Rodar `security--run_security_scan` no final da auditoria para validação cruzada.

### Fase 2 — Fixes críticos

**2.1. Deletar `seed-test-users`**
- Remover `src/routes/api/public/hooks/seed-test-users.ts`.
- Remover secret `SEED_SECRET`.

**2.2. Trocar proteção do `sync-ghl`**
- Anon key é pública (vai no bundle client + commitada em `.env`). Hoje qualquer pessoa com DevTools dispara o cron.
- Gerar novo secret `CRON_SHARED_SECRET` (via `generate_secret`, 64 chars).
- Trocar comparação em `src/routes/api/public/hooks/sync-ghl.ts` para `x-cron-secret` header vs `CRON_SHARED_SECRET`, com `timingSafeEqual`.
- Atualizar a definição do `pg_cron` (via `supabase--insert`) para enviar o novo header.
- Manter idempotência (já tem `upsert ignoreDuplicates`).

**2.3. Corrigir leaks server→client (se a auditoria achar algum)**
- Mover imports top-level de `client.server` para dynamic import dentro de `.handler()`.
- Renomear helpers expostos para `.server.ts` quando aplicável.
- Se nada for encontrado, documentar "graph limpo" no relatório.

### Fase 3 — Validação

- Build automático do harness valida que nada quebrou.
- Smoke test do `sync-ghl` com novo header via `curl` (deve retornar 200 com header certo, 403 sem).
- Confirmar que GHL sync continua rodando no próximo ciclo do cron.
- Reportar findings residuais do `security_scan`.

### Fora de escopo (próximas sprints)

- Rate limiting na rota de sync (mitigado pelo secret).
- Rotação automatizada de `GHL_TOKEN` / `LOVABLE_API_KEY`.
- Audit log estruturado de tentativas rejeitadas.
- Qualquer mudança em email infra ou frequência de cron de email.

### Entregáveis

1. Relatório de auditoria em chat com riscos classificados (Crítico/Alto/Médio/Baixo).
2. `seed-test-users` removida.
3. `sync-ghl` protegida por secret dedicado.
4. Leaks server→client corrigidos (ou confirmação de que não há).
5. Resultado do `security_scan` pós-fixes.
