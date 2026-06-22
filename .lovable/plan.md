## Tela de Agenda — visão diária por profissional (dados reais GHL) — v2

Modo ADMIN fixo (sem login ainda). Frontend nunca chama GHL direto — tudo via `ghl-proxy`.

### Decisões das 4 perguntas

1. **free-slots + events combinados**: free-slots dá horários LIVRES (já desconta ocupados). Para mostrar quem reservou e qual serviço, busco `/calendars/events` em paralelo. Reconciliação: a grade é gerada a partir do horário de funcionamento (free-slots cobre os livres); os "buracos" entre free-slots são marcados ocupados; cada event do `/calendars/events` que cair em um buraco preenche `contactName` + `serviceName`. Um mesmo slot NUNCA aparece como livre e ocupado — fonte da verdade para "livre" é o free-slots.
2. **Version header**: `2021-04-15` para AMBOS endpoints (confirmado na doc oficial GHL).
3. **timezone**: vai como query param `timezone=Europe/Brussels` (URL-encoded). O proxy já faz `searchParams.set`.
4. **Janela horária dinâmica**: default 08:00–22:00, mas expande automaticamente se algum event/free-slot do dia cair fora dessa faixa (arredonda para a meia-hora mais próxima). Nada some.

### Arquivos

**Novo** `src/config/staff.ts` — array tipado com 5 calendários (Gabriel, Joyce, Andre, Augusto, Randevu): `{ id, name, calendarId, initials, color }`. Avatares = iniciais sobre cor.

**Editar** `src/lib/ghl.ts` — adicionar:
- `getFreeSlots(calendarId, startMs, endMs, tz="Europe/Brussels")` → GET `/calendars/{id}/free-slots?startDate&endDate&timezone`
- `getEvents(calendarId, startIso, endIso, locationId)` → GET `/calendars/events?calendarId&startTime&endTime&locationId`
- Ambos com `version: "2021-04-15"`.

**Novo** `src/hooks/use-agenda.ts` — `useStaffDayAgenda(date)`:
- Para cada staff, `Promise.allSettled([freeSlots, events])` do dia (00:00→23:59 Brussels).
- `refetchInterval: 120_000`, `staleTime: 60_000`, `refetchIntervalInBackground: false`.
- Normaliza para `{ staffId, freeSlots: TimeRange[], events: Event[], error?: string }`.
- Erro num staff vira `error` no objeto dele, não derruba os outros.

**Novo** `src/lib/agenda-grid.ts` — função pura que recebe `freeSlots + events + dayStart` e devolve:
- `gridStart`, `gridEnd` (default 08:00–22:00, expande se algo cair fora).
- `slots: { time, status: "free" | "booked" | "outside", contactName?, serviceName? }[]` em granularidade de 30 min.
- Regra: slot livre se cair dentro de algum free-slot range; ocupado se um event o cobrir; "outside" se fora do funcionamento (cinza apagado, não clicável).

**Novo** `src/routes/agenda.tsx` (rota `/agenda`). `src/routes/index.tsx` redireciona para `/agenda` (sem SSR auth, rota pública por enquanto).

UI mobile-first, fundo `#000`/`#1A1A1A`, acento `#E11D2A`:

```
┌─────────────────────────────────────────┐
│ [<]  ter, 24 jun 2026  [>]  💬 🔔 👤   │ header sticky
├─────────────────────────────────────────┤
│        GAB JOY AND AUG RDV              │ headers das colunas
│ 09:00│ ░░░│    │    │███ │    │        │
│ 09:30│ ░░░│███ │    │███ │    │        │ ░ livre / ███ ocupado
│ 10:00│    │███ │    │    │░░░ │        │
├─────────────────────────────────────────┤
│  📅    ✂️     ➕     ⭐    ☰           │ bottom nav fixa
└─────────────────────────────────────────┘
```

- Seletor de data: setas + popover `<Calendar>` shadcn + chip "Hoje".
- Grid: coluna esquerda fixa com horários, colunas dos staffs com `overflow-x-auto`, largura mínima ~96px por coluna.
- Livre: borda tracejada vermelha, label "Sem reserva", clicável → toast "em breve".
- Ocupado: card vermelho-escuro com horário + nome + serviço, `cursor-not-allowed`.
- Outside: cinza apagado.
- Erro por coluna: badge vermelho no header da coluna + tooltip com mensagem bruta do GHL (status + body).
- Loading: skeleton por coluna.
- Bottom nav: 5 itens, "+" central elevado vermelho, só Agenda ativo.

**Editar** `src/i18n/locales/{pt,fr,en}.json` — chaves: `agenda.title/today/noBooking/client/service/errorLoading/outside`, `nav.agenda/services/new/reviews/menu`.

### Fora de escopo

Criar/editar/cancelar agendamentos. Login e papéis reais. Telas Serviços/Avaliações/Menu/Chat/Notificações. Drag-to-create. Visão semana/mês.

### Como testar

1. Liberar scope `calendars/events.readonly` no `GHL_TOKEN` (você disse que vai fazer).
2. Abrir `/agenda` no preview.
3. Ver 5 colunas (Gabriel, Joyce, Andre, Augusto, Randevu) com horários do dia atual.
4. Confirmar blocos livres onde o GHL tem disponibilidade.
5. Confirmar blocos ocupados com nome do cliente + serviço.
6. Navegar dia ±1 com as setas, escolher data no popover.
7. Aguardar 2 min sem interagir → ver dados re-buscarem (Network tab mostra POST para `ghl-proxy`).
8. Se algum staff der erro → badge vermelho na coluna, demais funcionam.
9. Se um agendamento existir às 7:00, a grade começa em 7:00 automaticamente.
