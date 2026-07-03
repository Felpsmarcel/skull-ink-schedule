## Objetivo

Cards de agendamento no `WeekView` e `MonthView` (mobile + desktop) devem:
1. Truncar de forma inteligente para nunca quebrar o layout.
2. Ao clicar, abrir o `AgendaAppointmentSheet` já existente (mesmo componente usado no Day view) com detalhes completos: horário, duração, cliente, contato, serviço, status de pagamento.
3. No desktop (`sm+`), mostrar um `Tooltip` no hover com resumo (cliente + horário + serviço) para leitura rápida sem abrir o sheet.

## Escopo

- `src/routes/_authenticated/agenda.tsx` — Week/Month.
- Nenhuma mudança em backend, hooks, RPCs, ou no próprio `agenda-appointment-sheet.tsx`.

## Semana (WeekView)

- **Mobile (lista de dia único)**: cada linha de agendamento vira `<button>` clicável (área toque ≥ 44px alto). Nome do cliente com `truncate` + `flex-1 min-w-0`; hora fixa à esquerda; badge de status à direita; ícone chevron sutil indicando "toque para detalhes".
- **Desktop (grid 7 dias)**: cada card no cell vira `<button>` envolto em `Tooltip` (shadcn `@/components/ui/tooltip`) que mostra ao hover: `HH:mm–HH:mm · Cliente · Serviço/Título`. `truncate` no nome mantém a única linha; hora com `tabular-nums`.
- Clique (mobile e desktop) chama `openEvent(ev, staff)` que constrói um `GridSlot` sintético a partir do `GhlEvent`:
  ```
  { startMs, eventStartMs, eventEndMs, label: HH:mm, status: "booked",
    contactName, contactId, ghlEventId: ev.id, serviceName: ev.title,
    appointmentStatus: ev.appointmentStatus, isFirstSlot: true, spanSlots: 1 }
  ```
  e abre `AgendaAppointmentSheet` com `staffName`, `calendarId` (do `staff` do agendamento), `bucket` via `statusMap.get(ev.id)`.

## Mês (MonthView)

- A célula do dia continua clicável para abrir o Day view (comportamento atual). Cards individuais não existem no mês por design — mas:
- **Desktop (`sm+`)**: envolver a fileira de avatares num `Tooltip` que lista os agendamentos daquele dia (`HH:mm Cliente` por linha, até 8 itens + `+N`). Isso permite ver detalhes sem sair da grade.
- **Mobile**: manter o comportamento atual (toque → Day view). Não introduzir tooltip (não há hover em toque).

## Estado & sheet

- Adicionar `useState<{ ev: GhlEvent; staffName: string; calendarId: string } | null>` em `WeekView`.
- Renderizar `<AgendaAppointmentSheet>` no final do `WeekView` (mesma prop shape do Day view), passando o `GridSlot` sintético.
- Sem mudanças no `MonthView` além do tooltip visual.

## Truncamento inteligente

- Toda linha de texto do card usa: container `flex min-w-0`, texto com `truncate` (single line) ou `line-clamp-2` para o campo `title` no tooltip.
- Ícones/avatares/badges com `shrink-0`.
- Hora sempre `tabular-nums` e largura mínima fixa (`w-10` mobile / `w-12` desktop) para alinhar coluna.

## Validação

- Preview mobile 390px: tocar num card do Week abre o sheet com detalhes; nada estoura horizontalmente; textos longos truncam com `…`.
- Preview desktop: hover no card mostra tooltip; clique abre sheet; grid preservado.
- Month desktop: hover na fileira de avatares mostra lista de agendamentos do dia; toque no dia continua indo para Day view.
- Sem regressão no Day view, no header, na navegação, ou no `financeiro`.
