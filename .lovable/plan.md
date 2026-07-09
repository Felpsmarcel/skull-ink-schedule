## Objetivo

Após reatribuir o tatuador no `AgendaAppointmentSheet`, invalidar **todas** as caches que exibem esse agendamento — hoje a agenda semanal/mensal e o financeiro continuam com o valor antigo até um refresh manual.

## Diagnóstico

No `onSuccess` da mutação `reassignAppointmentArtist` (src/components/agenda-appointment-sheet.tsx ~linha 1068) invalido só:

- `["agenda"]` → cobre a **visão diária** (`useStaffDayAgenda`)
- `["agenda-status"]` → cobre badges do dia
- `["appointment-finance", ghlEventId]` → detalhe financeiro dentro do sheet

Ficam de fora:

- `["agenda-range", ...]` → visão semanal/mensal (`useStaffRangeAgenda`) — o card não some do artista antigo nem aparece no novo
- `["agenda-status-range", ...]` → badges da visão de intervalo
- `["finance-summary"]` → cards de "A Receber / Pendente / Pago" no `/financeiro` (artista mudou → linha muda de painel)

## Mudança

Arquivo único: `src/components/agenda-appointment-sheet.tsx`, no `onSuccess` de `reassign`, adicionar três invalidações:

```ts
queryClient.invalidateQueries({ queryKey: ["agenda-range"] });
queryClient.invalidateQueries({ queryKey: ["agenda-status-range"] });
queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
```

Mantém as três atuais. Usar prefixo (sem os argumentos de data) invalida todas as janelas em cache, que é o comportamento certo — não sei em qual semana/mês o usuário está.

## Fora de escopo

- Optimistic update (mover o card na hora); manter o refetch como está.
- Refatorar as mutações de status/pagamento (linha ~269) — já cobrem o suficiente para o caso delas.
