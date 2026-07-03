## O que muda para o usuário

Hoje o status ("Pendente", "A receber", "Pago") é **calculado automaticamente**:

- tem pagamento registrado → **Pago**
- sem pagamento e horário já passou → **Pendente**
- sem pagamento e horário no futuro → **A receber**

Você quer poder **forçar** um desses status direto no agendamento, sem depender de pagamento. Por exemplo: marcar como "Pago" mesmo sem lançar pagamento, ou marcar um agendamento passado como "A receber" porque o cliente vai pagar depois.

## Como vai funcionar

No sheet do agendamento (Agenda), na seção **Financeiro**, adiciono um controle novo:

```text
Status do pagamento:  [ Automático ▾ ]
                        Automático (padrão)
                        Pago
                        Pendente
                        A receber
```

- **Automático** = usa a regra atual (baseada em pagamentos + data).
- **Pago / Pendente / A receber** = trava aquele status, ignorando a regra.

O badge no topo do sheet, na grade da Agenda (semana/dia/mês) e nas listas do Financeiro passam a mostrar o status forçado quando existir; se estiver em "Automático", nada muda em relação a hoje.

Um pequeno ícone (ex.: cadeado) aparece no badge quando o status foi definido manualmente, para diferenciar do calculado.

## Permissões

- **Admin**: pode mudar qualquer agendamento.
- **Tatuador**: pode mudar apenas os seus próprios agendamentos (mesma regra do restante do financeiro).

## Detalhes técnicos

### 1. Banco — nova coluna em `appointments`

Migration adiciona:

- `manual_payment_status text NULL` com CHECK `IN ('pago','pendente','a_receber')`.
- `manual_payment_status_by uuid NULL` (auth.uid de quem definiu, para auditoria).
- `manual_payment_status_at timestamptz NULL`.

Sem alteração de RLS (as policies atuais de `appointments` já cobrem UPDATE por admin/tatuador dono).

### 2. Lógica de derivação — `src/lib/finance.functions.ts`

`deriveBucket()` passa a aceitar um terceiro parâmetro opcional `override`:

```ts
export function deriveBucket(
  startAt: string,
  hasPayment: boolean,
  override?: PaymentBucket | null,
): PaymentBucket {
  if (override) return override;
  if (hasPayment) return "pago";
  return new Date(startAt).getTime() < Date.now() ? "pendente" : "a_receber";
}
```

Todos os call sites que hoje chamam `deriveBucket(startAt, hasPayment)` passam a ler também `manual_payment_status` da linha e repassar. Arquivos tocados:

- `src/lib/finance.functions.ts` (resumo do Financeiro — admin e artista)
- `src/lib/agenda-status.functions.ts` (mapa de status da Agenda)
- `src/lib/appointments.functions.ts` (`getAppointmentFinanceByGhlId` — badge do sheet)

### 3. Nova server function — `setAppointmentPaymentStatus`

Em `src/lib/appointments.functions.ts`, com `requireSupabaseAuth`:

- Input: `{ ghlAppointmentId, status: 'pago' | 'pendente' | 'a_receber' | null }` (null = voltar para Automático).
- Verifica papel: admin passa; tatuador só se `artist_id === current_artist_id()`.
- Faz `update appointments set manual_payment_status = ?, manual_payment_status_by = auth.uid(), manual_payment_status_at = now() where ghl_appointment_id = ?` via `supabaseAdmin` (após checagem de permissão).
- Retorna o novo bucket efetivo.

**Não** cria nem apaga registros em `payments`. É apenas um override de exibição/classificação.

### 4. UI — `src/components/agenda-appointment-sheet.tsx`

Na `FinanceSection`, acima do bloco "Registrar valor / Registrar pagamento", adiciono um `<Select>` com as 4 opções (Automático + 3 status). Ao mudar:

- Chama `setAppointmentPaymentStatus` via `useServerFn`.
- Invalida `['appointment-finance', ghlId]`, `['finance']`, `['agenda-status']` — igual ao que já é feito nas outras ações do sheet.
- Toast de sucesso/erro.

O `StatusBadge` do topo do sheet ganha um ícone `Lock` (lucide) quando `manual_payment_status` está preenchido.

### 5. Agenda e Financeiro — badge com indicador

Em `src/routes/_authenticated/agenda.tsx` e `src/routes/_authenticated/financeiro.tsx`, o `StatusBadge` passa a receber opcionalmente um `icon={<Lock className="h-3 w-3" />}` quando a linha vier com `manualOverride: true`. Requer adicionar `manualOverride: boolean` ao shape das linhas em `finance.functions.ts` e `agenda-status.functions.ts`.

Nenhuma mudança nos rótulos ("Pendente", "A receber", "Pago") nem nas cores.

## Arquivos afetados

- `supabase/migrations/<nova>.sql` (colunas de override)
- `src/lib/finance.functions.ts`
- `src/lib/agenda-status.functions.ts`
- `src/lib/appointments.functions.ts` (nova server fn + leitura do override)
- `src/hooks/use-agenda-status.ts` (repassar `manualOverride`)
- `src/components/agenda-appointment-sheet.tsx` (Select + ícone)
- `src/routes/_authenticated/agenda.tsx` (ícone no badge)
- `src/routes/_authenticated/financeiro.tsx` (ícone no badge)

## Fora do escopo

- Não renomeia os status (continuam "Pendente", "A receber", "Pago").
- Não muda cores.
- Não cria/apaga pagamentos automaticamente ao mudar o status.
- Não adiciona histórico visível de mudanças (só grava quem/quando no banco para auditoria futura).
