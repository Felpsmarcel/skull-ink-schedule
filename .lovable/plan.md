## Sprint 2 — proposta do Tech Lead

Objetivo: tirar o app do estado "fluxo funciona em condições ideais" e levar para "fluxo confiável em produção". Foco em **integridade de dados (GHL ↔ Supabase)** e **fechar buracos do fluxo de agendamento que já estão à mostra**. Sem features novas grandes; sem mexer em finanças, agenda, ou design.

### Por que essa Sprint, e não outra

Hoje a maior dívida não é UI nem features — é **consistência**. O Bloqueio #1 foi resolvido (server fn SECURITY DEFINER), mas três problemas reais continuam de pé e todos vão estourar em produção antes de qualquer feature nova valer a pena:

1. **Sem backfill GHL → Supabase.** Eventos criados fora do app (no próprio GHL, por telefone, pelo cliente) nunca aparecem no banco. Hoje o app só "vê" o que ele mesmo criou. Qualquer relatório financeiro é parcial por definição.
2. **Sem reconciliação quando o GHL falha no meio.** A server fn compensa GHL→DB, mas não há retry/fila para o caso inverso (evento criado no GHL, app caiu antes de inserir). Hoje o aviso é só `console.error` no servidor — ninguém lê.
3. **Duplicação no fluxo de finalização.** `appointments.new.index.tsx` e `appointments.new.checkout.tsx` chamam `finalizeAppointment` em paralelo, com lógicas próprias de validação. Já identificado em auditoria; é onde o próximo bug vai nascer.

Auth, recovery UI e Sprint 5 (KPIs) ficam para depois — não bloqueiam ninguém hoje.

### Escopo (3 entregas, nessa ordem)

**1. Sync GHL → Supabase (backfill incremental)**
- Server fn `syncGhlAppointments` (SECURITY DEFINER, admin-only quando chamada manualmente).
- Lê eventos do GHL por janela (`startTime` últimos 7 dias → próximos 90 dias) por `calendarId` de cada artista ativo.
- Upsert em `public.appointments` por `ghl_appointment_id` (UNIQUE). Campos sensíveis (`total_eur`, `commission_pct`) **só** são definidos se o registro estiver sendo criado por sync — nunca sobrescreve valores já gravados pela server fn de checkout.
- Status mapping GHL→app (`confirmed`, `cancelled`, `noshow`, `showed` → `confirmed/cancelled/no_show/completed`).
- Agendamento: `pg_cron` a cada 10 min chamando rota pública `/api/public/hooks/sync-ghl` autenticada por header secreto (`SYNC_SECRET`). Padrão idêntico ao `seed-test-users`.
- Botão "Sincronizar agora" no `/financeiro` (apenas admin) para forçar execução e ver erros.

**2. Reconciliação de eventos órfãos**
- Tabela `public.ghl_sync_failures` (id, ghl_event_id, reason, payload jsonb, created_at, resolved_at). Admin-only.
- Quando `createAppointmentRecord` falha no insert e a compensação no GHL também falha, em vez de só logar: grava em `ghl_sync_failures` e retorna `warning` na response (UI já tem `warning?` no tipo, hoje não usado).
- Tela admin `/financeiro/reconciliar` listando falhas em aberto, com ação "marcar como reconciliado" (atualiza `resolved_at`). Sem auto-retry — risco de duplicar é maior que o ganho.
- Toast de aviso na UI de checkout quando `warning` vem na response.

**3. Unificar o caminho de finalização**
- Extrair a lógica de validação do draft (contato, artista, data, ≥1 serviço, calendário) para `src/lib/appointment-draft-validate.ts` puro, com discriminated union `{ ok: true, payload } | { ok: false, reason }`.
- `appointments.new.index.tsx` e `appointments.new.checkout.tsx` passam a usar o mesmo validador e o mesmo handler `useFinalizeAppointment` (novo hook que envolve `useServerFn(createAppointmentRecord)` + invalidate de queries + toast + reset do draft + navegação).
- Botão "Salvar" no index passa a redirecionar para `/appointments/new/checkout` em vez de finalizar direto. **Existe um único ponto de finalização**: o checkout. Reduz superfície de bug e alinha com o fluxo de 3 telas que o usuário pediu originalmente.

### Mudanças técnicas (resumo para review)

- **Migration**: nova tabela `ghl_sync_failures` + RLS admin-only + GRANTs; cron job `pg_cron` apontando para a rota pública; segredo `SYNC_SECRET` via add_secret.
- **Novos arquivos**: `src/lib/sync.functions.ts`, `src/routes/api/public/hooks/sync-ghl.ts`, `src/lib/appointment-draft-validate.ts`, `src/hooks/use-finalize-appointment.ts`, `src/routes/_authenticated/_admin/reconciliar.tsx`.
- **Edits**: `src/lib/appointments.functions.ts` (gravar falha de compensação na tabela), `appointments.new.index.tsx` (remove finalize, vira "Continuar"), `appointments.new.checkout.tsx` (usa o hook unificado), `financeiro.tsx` (botão admin "Sincronizar agora" + link "Reconciliar").
- **Sem mudança**: schema de `appointments`, `artists`, `services`, `app_users`, finanças, agenda, GHL proxy, design.

### O que NÃO entra

- Auth recovery UI / esqueci minha senha / convite por email (Sprint 4).
- Pipelines / pagamento real (próxima sprint depois de Sprint 4).
- Notificações para o cliente final.
- Edição/cancelamento de appointment existente — só leitura sincronizada nesta sprint. Editar continua sendo no GHL.
- Bottom Nav: stubs continuam stubs nesta sprint.

### Critérios de aceite

- Criar appointment direto no GHL (web) → aparece em `/financeiro` em ≤10 min sem ação manual; admin consegue clicar "Sincronizar agora" e ver na hora.
- Forçar falha de insert (simulação) → registro aparece em `/financeiro/reconciliar` com `ghl_event_id`; toast de aviso aparece no checkout.
- Tentar finalizar com draft incompleto a partir de qualquer uma das 3 telas → mesmo erro, mesmo comportamento.
- Logar como artista, finalizar → continua funcionando (não-regressão do Bloqueio #1).
- Linter Supabase: sem warning novo introduzido por esta sprint.

### Riscos

- **Médio**: cron tocar a tabela e sobrescrever um `total_eur` correto. Mitigado por `INSERT ... ON CONFLICT DO UPDATE SET ... WHERE appointments.total_eur IS NULL` (sync nunca sobrescreve valores já confiáveis do checkout).
- **Baixo**: rota pública `/api/public/hooks/sync-ghl` exposta. Mitigado por header `x-sync-secret` (padrão idêntico ao já existente em `seed-test-users`).
- **Baixo**: duplicar handler de finalização durante a refactor. Mitigado por extrair primeiro o validador puro com testes e só depois mexer nas duas telas.

Aprovado para implementar?
