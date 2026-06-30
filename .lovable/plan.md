
# Triagem Tech Lead — Itens da Sprint 2

Critério de bloqueio: **impede subir a Sprint 3 com segurança em produção** (perda de dado, inconsistência financeira, brecha de segurança, ou risco de corromper o banco). Tudo o mais é dívida priorizável, não bloqueador.

---

## 🔴 BLOQUEADORES (resolver antes da Sprint 3)

### B1. Sync sem `upsert` em `ghl_appointment_id`
- **Onde**: `src/lib/sync.server.ts` (insert em lote após `select … in ids`).
- **Por que bloqueia**: cron roda a cada 10 min. Se um run atrasa e sobrepõe o próximo (ou se admin clica "Sincronizar" durante o cron), o segundo run lê o `existing` antes do primeiro ter commitado e tenta `INSERT` duplicado. Resultado: erro de unique key, **toda a batch da calendário falha**, e ainda gera ruído em `ghl_sync_failures`. Em produção isso vira incidente recorrente silencioso.
- **Correção**: trocar `insert` por `upsert({ onConflict: 'ghl_appointment_id', ignoreDuplicates: true })` (ou update parcial preservando `total_eur`, `commission_pct`, `services`).

### B2. `commission_pct` indefinido em inserts vindos do sync
- **Onde**: `sync.server.ts` monta `rows` sem `commission_pct`. Eventos criados direto no GHL (fora do app) entram com NULL ou default da tabela.
- **Por que bloqueia**: Sprint 3 vai mexer em KPIs / dashboards financeiros. Linha com `commission_pct` NULL faz `total_eur * commission_pct / 100` virar NULL e some do somatório — relatórios mentem sem alarme.
- **Correção**: resolver `commission_pct` via `artists.commission_pct` no momento do insert (já temos `artist_id` no scope).

### B3. Caminho de compensação GHL nunca foi exercitado
- **Onde**: `createAppointmentRecord` em `src/lib/appointments.functions.ts` — DELETE no GHL quando insert no DB falha.
- **Por que bloqueia**: é o único mecanismo que evita evento órfão no GHL com cobrança fantasma. Nunca foi testado end-to-end. Se estiver quebrado, descobrimos só quando um cliente real for cobrado errado.
- **Correção**: teste forçado (mockar falha no insert ou rodar com RLS hostil) + verificar que `ghl_sync_failures` recebe a falha quando o DELETE também falha. Sem teste real, **não sobe**.

---

## 🟡 ALTA PRIORIDADE (Sprint 3, não bloqueador)

### A1. Endpoint público `/api/public/hooks/sync-ghl` autenticado por anon key
- Anon key vai no bundle do frontend. Qualquer um dispara o cron manualmente → DoS leve (cada chamada bate N vezes no GHL).
- **Não bloqueia** porque: sem PII no retorno, sem escrita maliciosa possível (idempotente), GHL tem rate limit próprio.
- **Tratar com**: secret dedicado `CRON_SECRET` no header `apikey`, configurar no `pg_cron` (uma linha de SQL). Trivial, mas separado da Sprint 3.

### A2. Sem paginação em `/calendars/events`
- Hoje cabe em 1 página (≤90 dias × 4 artistas). Quebra silenciosamente quando volume crescer — eventos somem do mirror.
- **Não bloqueia agora**, mas vira incidente sem alarme. Adicionar guard: se `events.length === limite`, logar warning e paginar.

### A3. Cron nunca observado em `cron.job_run_details`
- Está agendado e `active=true`, mas ninguém viu um run concluir. Pode estar falhando 100% das vezes silenciosamente.
- **Bloqueio condicional**: se inspeção de `cron.job_run_details` mostrar 0 runs de sucesso, **vira B4** e bloqueia.
- Custo: 1 query read-only. Faço junto com B1/B2/B3.

---

## 🟢 BAIXA / COSMÉTICO (backlog)

- **Botões duplicados "Checkout"** em `appointments.new.index.tsx` — UX feio, não é bug funcional.
- **`locationId` hard-coded** em `sync.server.ts` (já existe em `config/staff`) — DRY, não muda comportamento.
- **`notes` possivelmente `undefined`** no validate — edge case sem reprodução conhecida.
- **"Resolvido" em /reconciliar não reprocessa** — comportamento documentado, admin age manual no GHL.
- **Race compensação × cron** — eventual consistency aceitável, admin reconcilia.

---

## Recomendação

**Mini-sprint 2.5 (curta, ~1 ciclo)** com escopo travado em B1 + B2 + B3 + verificação de A3. Sem isso, qualquer feature nova da Sprint 3 corre risco de ser construída sobre dados inconsistentes ou de mascarar o bug original.

Depois disso, abre Sprint 3 com A1 e A2 entrando como tarefa de hardening dentro do escopo principal.

**Posso preparar o plano executável de Sprint 2.5 (B1+B2+B3+verificação A3) com os patches específicos?**
