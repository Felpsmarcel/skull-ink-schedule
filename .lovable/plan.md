## Estado atual

O comportamento pedido já está implementado em `src/routes/_authenticated/agenda.tsx` (implementado em turno anterior):

- `StaffColumn` passa `staff.calendarId` para `SlotCell`:
  ```tsx
  slots.map((slot) => (
    <SlotCell key={slot.startMs} slot={slot} calendarId={staff.calendarId} />
  ))
  ```
- `SlotCell` para `slot.status === "free"` renderiza o botão "Sem reserva" cujo `onClick`:
  ```tsx
  draft.reset();
  draft.setCalendar(calendarId);
  draft.setStart(new Date(slot.startMs).toISOString());
  void navigate({ to: "/appointments/new" });
  ```
- `slot.status === "booked"` renderiza div com `cursor-not-allowed`, sem handler.
- `slot.status === "outside"` renderiza célula vazia, sem handler.
- O FAB central "Novo" do `BottomNav` continua chamando `navigate({ to: "/appointments/new" })` sem mexer no draft.

## Critérios de aceite — checagem

1. Clicar em livre → navega para `/appointments/new`. ✅
2. Calendário pré-selecionado via `setCalendar(calendarId)`. ✅
3. Horário pré-selecionado via `setStart(ISO)`. ✅
4. Cliente e serviço continuam pendentes (draft.reset apaga só esses campos antes de setar calendar/start). ✅
5. Slots ocupados sem onClick. ✅
6. FAB "Novo" intocado. ✅

## Ação proposta

Nenhuma. Não há código a alterar. Se você está vendo comportamento diferente em runtime (ex.: clicou e não navegou, ou foi para outro lugar), me diga o caso específico — tatuador, data, horário, role (admin/artista) — que eu investigo. Caso contrário aprovar este plano fecha a tarefa como já entregue.
