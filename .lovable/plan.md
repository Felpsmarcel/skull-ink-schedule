## Diagnóstico

O erro `"Agendamento sem contato vinculado no banco — não é possível registrar pagamento."` vem de `registerAppointmentPayment` em `src/lib/appointments.functions.ts`, que exige `appointments.contact_id` (uuid) para inserir em `payments` (a coluna `payments.contact_id` é `NOT NULL`).

Verifiquei no banco:

- `appointments.contact_id` (uuid, FK para `contacts.id`) está **NULL em todos os registros**.
- A tabela `appointments` só está guardando `ghl_contact_id` (texto vindo do GHL).
- A sincronização `src/lib/sync.server.ts` faz upsert do agendamento com `ghl_contact_id`, mas **nunca cria/vincula a linha em `public.contacts`** nem preenche `appointments.contact_id`.
- A tabela `contacts` existe e tem `ghl_contact_id` — é onde o `contact_id` deveria apontar.

Ou seja: o pagamento falha porque o "elo" entre agendamento e contato no banco nunca foi criado. Não é bug do formulário, é dado ausente.

## Como resolver

Duas correções complementares — a primeira desbloqueia agora, a segunda evita repetir o problema.

### 1. Resolver o contato na hora de registrar o pagamento (desbloqueio imediato)

Em `registerAppointmentPayment` (`src/lib/appointments.functions.ts`), quando `appt.contact_id` for `null`:

1. Ler `appt.ghl_contact_id`, `contact_name`, `contact_phone`, `contact_email` do próprio agendamento.
2. Fazer `upsert` em `public.contacts` por `ghl_contact_id` (com nome/telefone/e-mail que já temos) usando `supabaseAdmin`, retornando o `id`.
3. Fazer `update` em `appointments.contact_id = <novo id>` (backfill, para próximas vezes ser instantâneo).
4. Inserir o `payments` com esse `contact_id`.

Se `appt.ghl_contact_id` também for null (agendamento manual sem contato), aí sim mostrar mensagem clara pedindo pra vincular um contato.

### 2. Corrigir a sincronização (para novos agendamentos nascerem vinculados)

Em `src/lib/sync.server.ts`, dentro do loop que faz upsert de eventos GHL, antes de gravar o `appointments`:

- Se `e.contactId` existir, fazer `upsert` em `public.contacts` (por `ghl_contact_id`) com os dados de contato do evento e recuperar o `id`.
- Gravar esse `id` em `appointments.contact_id` junto com `ghl_contact_id`.

Assim todo agendamento novo já sai com o link pronto e o botão "Registrar pagamento" funciona de primeira, sem fallback.

### 3. (Opcional, mesma migração) Backfill único dos agendamentos existentes

Migration SQL que, para cada `appointments` com `contact_id IS NULL AND ghl_contact_id IS NOT NULL`:

- Insere em `contacts` (`ON CONFLICT (ghl_contact_id) DO NOTHING`) usando `contact_name/phone/email` do próprio agendamento.
- `UPDATE appointments a SET contact_id = c.id FROM contacts c WHERE c.ghl_contact_id = a.ghl_contact_id AND a.contact_id IS NULL`.

Com isso, os agendamentos que já existem (incluindo o do print, Thomas Watt) passam a aceitar pagamento sem precisar de upsert em runtime.

## Escopo

- **Editado:** `src/lib/appointments.functions.ts` (fallback em `registerAppointmentPayment`), `src/lib/sync.server.ts` (upsert de contact + link).
- **Migração:** backfill de `appointments.contact_id` + garantir índice único em `contacts.ghl_contact_id` se ainda não existir.
- **Sem mudanças de UI** — o sheet e o formulário continuam iguais; só o backend passa a resolver o contato sozinho.

## Confirme antes de eu implementar

Quer que eu faça as 3 partes (fix imediato + fix da sync + backfill) ou só o fix imediato agora?