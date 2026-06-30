## Objetivo
Mostrar na Agenda, dentro dos cards de horários ocupados, uma pílula `StatusBadge` indicando se o agendamento está pago / pendente / a receber, e exibir `StatusBadge` "Erro" quando a coluna do tatuador falha ao carregar do GHL. Reutilizar o componente criado na sprint anterior — sem novas variantes nem mudanças no design system.

## 1. Server function — `src/lib/agenda-status.functions.ts` (novo)
- `getDayAppointmentStatuses({ dateISO })`, com `requireSupabaseAuth`.
- Calcula intervalo do dia em Europe/Brussels (reuso de `brusselsDayStartMs/EndMs`).
- Lê de `public.appointments` (RLS já cobre admin × artista) os registos cujo `start_at` cai no dia e `ghl_appointment_id is not null`: campos `id`, `ghl_appointment_id`, `start_at`, `artist_id`.
- Lê `public.payments` (status `paid`) só pelos `appointment_id` desse conjunto.
- Aplica a mesma função `deriveBucket(start_at, hasPayment)` já usada em `finance.functions.ts` (importada de lá para não duplicar lógica).
- Retorna `Array<{ ghlAppointmentId: string; artistId: string; bucket: "pago" | "pendente" | "a_receber" }>`.
- Sem `INSERT/UPDATE`, sem chamadas ao GHL. Sem alterar migrations nem `finance.functions.ts` (só `import { deriveBucket }` — se hoje for privada, expô-la com `export` é a única alteração necessária; nada de lógica nova).

## 2. Hook — `src/hooks/use-agenda-status.ts` (novo)
- `useDayAppointmentStatuses(date)` usa TanStack Query; queryKey `["agenda-status", brusselsDayKey(date)]`.
- Retorna `{ map: Map<string /* ghlAppointmentId */, PaymentBucket>, isLoading, error }`.

## 3. `src/lib/agenda-grid.ts`
- `GridSlot` ganha `ghlEventId?: string` (opcional, retro-compatível).
- Em `buildDayGrid`, ao emitir slot `booked`, atribuir `ghlEventId: hit.ev.id`.

## 4. `src/routes/_authenticated/agenda.tsx`
- Importar `StatusBadge`, `bucketToVariant`, `bucketLabel` de `@/components/ui/status-badge`.
- Chamar `useDayAppointmentStatuses(date)` uma vez no componente pai e passar `statusMap` para cada `StaffColumn` → `SlotCell`.
- No branch `booked` do `SlotCell`:
  - Se `statusMap.get(slot.ghlEventId)` existir, renderizar um `<StatusBadge variant={bucketToVariant(bucket)} className="self-start mt-0.5 text-[9px] px-1 py-0">` abaixo do nome/serviço (não quebra altura da linha; cabe em mobile).
  - Se não existir (agendamento criado direto no GHL e ainda não espelhado), nenhum badge — mantém comportamento atual.
- No estado de erro de carga da coluna (linhas 282–286), substituir/acompanhar o ícone por `<StatusBadge variant="danger">Erro</StatusBadge>` (mantendo o `title={error}` para detalhe).
- Falhas silenciosas do `useDayAppointmentStatuses` não bloqueiam a renderização da agenda.

## 5. i18n
- Não criar novas chaves: labels já vêm de `bucketLabel` (PT). Etiqueta "Erro" reaproveita string existente `agenda.errorLoading` se preferirmos; caso contrário usar literal "Erro" inline (mesmo padrão hoje do app, sem regressão).

## Fora de escopo
- `styles.css`, tokens, dark mode.
- Lógica de bucket (reutilizada via `deriveBucket`).
- Realtime / sincronização adicional, GHL proxy, migrations.
- Alterar `finance.functions.ts` além de exportar `deriveBucket`.

## Critérios de aceite
- Cards de horários ocupados na Agenda mostram pílula colorida quando há registo correspondente em `appointments`.
- Coluna com falha de GHL exibe `StatusBadge` "danger".
- Mobile mantém densidade — badge cabe na linha de 30 min sem cortar texto.
- Admins veem statuses de todos os tatuadores; artistas só dos seus (garantido pela RLS já existente).
- Nenhuma quebra de tipos / build limpo.
