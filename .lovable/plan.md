
# PR Review — Sprint 2 (Data Integrity & Reliability)

Revisão independente, sem alterações no código. Validação feita por inspeção de código + consultas read-only ao banco (cron jobs e policies RLS). Não foi executado Playwright nesta passada.

---

## 1. Unificação do fluxo de finalização

- **Objetivo**: ter um único caminho de criação (GHL + Supabase) através do hook `useFinalizeAppointment`.
- **Arquivos**: `src/hooks/use-finalize-appointment.ts`, `src/lib/appointment-draft-validate.ts`, `src/lib/appointments.ts`, `src/lib/appointments.functions.ts`, `src/routes/_authenticated/appointments.new.index.tsx`, `src/routes/_authenticated/appointments.new.checkout.tsx`.
- **Arquitetura**: validação centralizada → hook → `finalizeAppointment` (wrapper) → `createAppointmentRecord` (SECURITY DEFINER). Boa separação client/server.
- **Riscos**:
  - 🟡 **Botões duplicados no index**: o footer de `appointments.new.index.tsx` tem **dois botões** ("Checkout" outline + "Checkout" primary) — ambos navegam para `/appointments/new/checkout`. Resíduo do refactor: o botão "Salvar" foi removido mas o slot ficou com label duplicado. Não causa bug, mas é UX regressão e cheira a código não revisto.
  - 🟡 `notes` é tratado como `string` no validate, mas a store pode entregar `undefined` em edge cases (não vi reset explícito) — baixo risco.
  - 🟢 Sem condição de corrida no draft: Zustand é síncrono e `setSaving` protege duplo submit.
- **Risco de regressão**: baixo — o fluxo antigo (escrita direta do client) foi removido junto com `INSERT` direto sobre `appointments` no RLS.
- **Manutenção**: simples, lógica está num único hook e numa única server fn.
- **Validação**: 🟡 **inspeção de código**. Não foi executado E2E Playwright nesta Sprint 2; o último E2E real foi na Sprint 1.

**Único caminho?** Sim em produção (só o checkout chama `run()`). **Código duplicado?** Resíduo cosmético (2 botões idênticos no index). **Draft consistente?** Sim (`draft.reset()` ao final, store persistida). **Race conditions?** Não identificadas.

---

## 2. Sync GHL → Supabase

- **Objetivo**: backfill periódico de eventos do GHL para `appointments`, sem sobrescrever campos financeiros.
- **Arquivos**: `src/lib/sync.server.ts`, `src/lib/sync.functions.ts`, `src/routes/api/public/hooks/sync-ghl.ts`, migração com `pg_cron` + `pg_net`.
- **Arquitetura**: server-only helper isolado em `.server.ts`, carregado via `await import()` dentro do handler (correto para Worker). Cron chama endpoint público autenticado por `apikey` header.
- **Riscos**:
  - 🟡 **Insert em lote sem `onConflict`**: usa `select(... in ids)` + filtro em memória para decidir insert vs update. Se dois cron runs sobrepuserem (timeout do anterior), pode haver duplicate key em `ghl_appointment_id`. Recomendado `upsert({ onConflict: 'ghl_appointment_id' })` ou lock.
  - 🟡 **`locationId` hard-coded** (`9iqrKUVPDddINb9S4Iwd`) em `sync.server.ts`. Já está em `config/staff` — duplicação.
  - 🟡 **Sem paginação** na chamada `/calendars/events`: assume que ≤90 dias futuros cabem numa página. Funciona hoje, frágil em escala.
  - 🟡 **`commission_pct` não é preenchido em inserts vindos do sync** — eventos criados fora do app (no GHL) entrarão com `commission_pct` default da tabela. Se default não existir, somatórios financeiros vão tratar como NULL.
  - 🟢 Update preserva `total_eur`, `commission_pct`, `services` (comentário e código batem).
  - 🟢 Falhas viram linhas em `ghl_sync_failures`.
- **Risco de regressão**: baixo no fluxo manual, médio em volume (cron a cada 10 min).
- **Manutenção**: ok, função única, mas precisa de upsert e paginação para escalar.
- **Validação**:
  - ✅ **Validado por execução (read-only no banco)**: cron `sync-ghl-appointments` está agendado e `active=true` (consulta `cron.job`).
  - 🔴 **Não validado**: nunca foi executado um run E2E observável (não inspecionei `cron.job_run_details` nem chamei o endpoint público nesta sessão). Não há prova de que o cron está realmente fazendo POST nem que o `apikey` casa.
  - 🟡 **Inspeção**: lógica de mapStatus, dedupe e compensação parecem corretas.

---

## 3. Reconciliação

- **Objetivo**: UI admin para ver/resolver `ghl_sync_failures`.
- **Arquivos**: `src/routes/_authenticated/_admin/reconciliar.tsx`, server fns `listOpenSyncFailures` / `resolveSyncFailure`.
- **Segurança RLS** (validado em `pg_policies`):
  - `ghl_sync_failures_admin_read` (SELECT) e `ghl_sync_failures_admin_resolve` (UPDATE) — ambas restritas a `current_user_role() = 'admin'`. ✅
  - Não há policy de INSERT — correto, inserts vêm via `supabaseAdmin` (service role).
- **Permissões app**: a rota está sob `_admin/`, gate client-side existe; backend valida `role=admin` dentro do server fn `runGhlSync` (linha 18). ✅
- **Integridade**: `payload` é serializado JSON-string antes de transitar (boa decisão para RPC). `resolved_at`/`resolved_by` são marcados na resolução.
- **Riscos**:
  - 🟡 "Resolvido" só marca a linha — não tenta reprocessar. Se a falha foi GHL→DB orfão, admin precisa agir manualmente no GHL. Documentado no UI.
  - 🟡 `listOpenSyncFailures` usa o supabase do usuário (RLS) — depende da policy admin estar correta. Está.
- **Validação**: 🟡 **inspeção de código + policies** confirmadas no banco. 🔴 não testado com falha real injetada.

---

## 4. Segurança

- **`SECURITY DEFINER`**: `createAppointmentRecord` autoriza (`role=admin` OU `artist_id=meu`) antes de qualquer side effect. ✅ Confere `calendarId` contra o do artista (anti-spoofing). Boa prática.
- **Preços server-side**: serviços recarregados do DB; `discountPct` validado 0–100 via Zod. Cliente não pode mentir sobre preço. ✅
- **`supabaseAdmin`**: importado dinamicamente dentro do handler (`await import`) — correto para não vazar no client bundle. ✅
- **Secrets**: `GHL_TOKEN`, `SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_ANON_KEY` lidos via `process.env` dentro de handlers. ✅
- **Rota pública `/api/public/hooks/sync-ghl`**:
  - Autenticada por `apikey === SUPABASE_PUBLISHABLE_KEY ?? SUPABASE_ANON_KEY`. **A anon key é pública** (vai no bundle do frontend) — qualquer usuário com inspetor de rede pode disparar o cron manualmente.
  - 🟡 **Vetor de abuso**: DoS por chamadas repetidas (cada chamada bate no GHL N vezes e escreve no DB). Sem rate limit. Não é catástrofe — é o padrão documentado pelo guia interno — mas vale notar.
  - 🟢 Endpoint não retorna PII, apenas contadores.
- **RLS appointments** (validado):
  - `appt_admin` (ALL) e `appt_artist_select`/`appt_artist_update` restritos a `artist_id = current_artist_id()`. ✅
  - **Não há policy de INSERT/DELETE para `authenticated`** — escrita só via service role (server fn). ✅ Confirma a correção do bloqueador da Sprint pre-2.
- **Compensação**: se DB falha após GHL criar, tenta DELETE no GHL; se DELETE falha, grava em `ghl_sync_failures`. ✅
- **Risco residual**:
  - 🟡 Race entre compensação e cron de sync: se compensação demora, o próximo cron pode reimportar o evento órfão. Hoje cai num insert novo (sem `total_eur`), depois quando o admin reconcilia precisa decidir. Não é incidente de segurança, é eventual consistency.

---

## Tabela final

| Item | Implementado | Validado | Risco |
|---|---|---|---|
| Hook unificado de finalização | ✅ | 🟡 inspeção | Baixo (botões duplicados no index — cosmético) |
| Validação centralizada do draft | ✅ | 🟡 inspeção | Baixo |
| Server fn `createAppointmentRecord` (preço autoritativo + autorização) | ✅ | 🟡 inspeção | Baixo |
| Compensação GHL on DB-fail | ✅ | 🔴 não exercitada | Médio (caminho de erro nunca testado) |
| `sync.server.ts` (backfill GHL→Supabase) | ✅ | 🟡 inspeção | Médio (sem upsert, sem paginação) |
| Cron `pg_cron` 10min | ✅ | ✅ agendado/ativo | Médio (nunca observei job_run_details) |
| Endpoint público `/api/public/hooks/sync-ghl` | ✅ | 🔴 não invocado nesta passada | Médio (apikey = anon, sem rate limit) |
| Tabela `ghl_sync_failures` + RLS admin | ✅ | ✅ policies confirmadas | Baixo |
| UI `/reconciliar` | ✅ | 🟡 inspeção | Baixo |
| `appointments` RLS sem INSERT direto | ✅ | ✅ policies confirmadas | Baixo |
| Botão "Sincronizar" no financeiro (admin) | ✅ | 🟡 inspeção | Baixo |

---

## Veredicto

**Pronto para merge?** Sim, com 1 ressalva cosmética (footer do `appointments.new.index.tsx` com dois botões "Checkout" — abrir issue de UI).

**Pronto para produção?** **Não com confiança plena.** Faltam validações em ambiente integrado antes de declarar GA.

**Dependências de ambiente para validar**:
1. Executar o cron pelo menos uma vez e inspecionar `cron.job_run_details` + `ghl_sync_failures` reais.
2. Forçar um cenário de DB-fail após GHL create para validar a compensação ponta a ponta.
3. Disparar `runGhlSync` manualmente via admin e medir tempo / count em volume real.
4. Verificar que `commission_pct` no insert vindo do cron usa default sensato (ou ajustar `sync.server.ts` para resolver via `artists.commission_pct`).

**Testes recomendados antes da Sprint 3**:
- E2E Playwright (Admin + Artist) criando appointment completo e validando linha em `appointments` com `total_eur` e `commission_pct` corretos.
- Teste manual: criar evento direto no GHL → aguardar cron → confirmar mirror.
- Teste de regressão: tentar `INSERT` direto em `appointments` como `authenticated` (deve falhar com 403/permission).
- Smoke do endpoint público com `apikey` errado (deve retornar 403) e correto (200).
- Rodar 2 syncs em paralelo e verificar ausência de duplicate key em `ghl_appointment_id` (vai expor a falta de upsert).

Nenhuma correção foi aplicada nesta revisão.
