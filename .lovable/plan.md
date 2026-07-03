## Resumo

Boa notícia: o esquema para conectar valores do agendamento ao Financeiro **já existe** no banco. O que falta é a UI para exibir/editar o valor a partir do agendamento e a sincronização quando o valor for informado no momento do agendamento (não só depois no /financeiro).

## Como está hoje

- `public.appointments` já tem `total_eur`, `original_eur`, `discount_eur`, `commission_pct`, `services jsonb`, `ghl_appointment_id` (link com o evento do calendário mostrado na Agenda).
- `public.appointment_services` guarda linhas de serviço com `price_eur`, `duration_min`, `quantity`.
- `public.payments` guarda recebimentos (`amount_eur`, `type`, `method`, `status`, `paid_at`) com FK a `appointment_id`.
- `src/lib/finance.functions.ts` já lê de `appointments.total_eur` para produzir os relatórios do Financeiro.
- `src/lib/sync.server.ts` já faz upsert de eventos do GHL para `appointments` (via `ghl_appointment_id`), então cada card do calendário tem uma linha correspondente no banco.

Ou seja, os dados já falam a mesma língua — falta ligar as duas telas na interface.

## O que fazer (3 partes)

### 1. Mostrar o valor no sheet de detalhes do agendamento
- No `AgendaAppointmentSheet`, buscar por `ghl_appointment_id` a linha em `appointments` (novo server fn `getAppointmentByGhlId` em `src/lib/appointments.functions.ts`, com `requireSupabaseAuth`).
- Exibir bloco **"Financeiro"** com: `total_eur`, `original_eur`, `discount_eur`, `commission_pct`, resumo de serviços (`services jsonb`) e status de pagamento (o `bucket` já vem do `useRangeAppointmentStatuses`).
- Restrição já discutida: mostrar valores APENAS quando o `artist_id` da linha for o próprio usuário logado (ou admin). Para os demais tatuadores, esconder o bloco financeiro e mostrar apenas "Valor não visível".

### 2. Adicionar/editar valor a partir do sheet
- Botão "Registrar valor" abre um mini-form (dentro do próprio sheet ou num sub-dialog):
  - `total_eur` (obrigatório), `discount_eur` (opcional), `commission_pct` (default do artista).
  - Seleção de serviços (multi-select de `public.services`) → grava linhas em `appointment_services` e recalcula `total_eur` automaticamente.
- Salvar chama um server fn `upsertAppointmentFinance` (`requireSupabaseAuth` + policy `artist_id = auth.uid()` ou admin) que:
  1. Garante que existe row em `appointments` (se ainda não sincronizada, cria via `ghl_appointment_id` + dados do evento).
  2. Atualiza `total_eur`, `original_eur`, `discount_eur`, `commission_pct`, `services jsonb`.
  3. Substitui `appointment_services` do agendamento.
- Após salvar, invalidar `["finance", ...]` e `["appointment", ghlId]` no react-query — o /financeiro atualiza automaticamente.

### 3. (Opcional, mesma tela) Registrar pagamento
- Botão secundário "Registrar pagamento" abre form curto: `amount_eur`, `method`, `type` (sinal/final/etc.), `paid_at` → insere em `payments`.
- Isso alimenta o bucket de status (pago/a receber/pendente) já usado pelo `StatusBadge` na Agenda.

## Escopo técnico

- **Sem mudança de schema** — todas as colunas já existem.
- Novos arquivos: `src/lib/appointments.functions.ts` (já existe, adicionar 2 funções), possivelmente `src/components/appointment-finance-form.tsx`.
- Alteração: `src/components/agenda-appointment-sheet.tsx` (novo bloco Financeiro + botões).
- RLS: usar policies já existentes de `appointments` / `appointment_services` / `payments`; validar via read query se `artist_id = auth.uid()` está coberto (senão, adicionar policy owner-scoped na mesma migração).
- Nenhuma alteração no /financeiro — ele passa a mostrar o valor automaticamente porque lê da mesma tabela.

## Perguntas antes de implementar

1. **Quem pode registrar valor?** Só o próprio tatuador do agendamento, ou também admin/dono do estúdio pode registrar por qualquer artista?
2. **Serviços obrigatórios ou valor livre?** Preferir "escolher serviços do catálogo (`services`) e somar" ou permitir digitar um valor livre sem serviços?
3. **Pagamento no mesmo fluxo ou depois?** Registrar valor + pagamento juntos no sheet, ou apenas valor na Agenda e pagamento continua sendo feito na tela /financeiro?

Responda essas 3 e eu implemento no próximo turno.
