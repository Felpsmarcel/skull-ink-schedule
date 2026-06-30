# Agenda: visão Dia / Semana / Mês

Hoje a agenda mostra só o dia. Vou adicionar um toggle **Dia / Semana / Mês** no header, sem refazer o que já funciona.

## Mudanças

### 1. `src/routes/_authenticated/agenda.tsx`
- Estado novo: `view: 'day' | 'week' | 'month'` (default `day`), persistido em `?view=` (validateSearch).
- Header: adicionar um `Tabs` (shadcn) ao lado do seletor de data com as 3 opções. Os botões `‹ ›` passam a deslocar dia/semana/mês conforme `view`. O `dateLabel` muda de formato (dia: "Seg, 30 jun"; semana: "30 jun – 06 jul"; mês: "Junho 2026").
- Render condicional:
  - `view === 'day'` → grid atual intacto.
  - `view === 'week'` → nova `WeekView`.
  - `view === 'month'` → nova `MonthView`.

### 2. Hook novo `src/hooks/use-agenda-range.ts`
- `useStaffRangeAgenda(start, end, { artistId })` — versão "range" do `useStaffDayAgenda`.
- Busca **só eventos** (`getEvents` por calendário no intervalo) — free-slots só faz sentido na visão dia, então não chamamos nas visões semana/mês (economiza chamadas e respeita scope).
- Retorna por staff: lista de `GhlEvent[]` no intervalo. Reaproveita `useArtists` e o gating por `artistId` igual ao hook atual.
- Também invalida pela mesma `queryKey: ['agenda', ...]` para o botão Sincronizar continuar refrescando.

### 3. `WeekView` (mesmo arquivo `agenda.tsx`)
- Layout: 7 colunas (Seg–Dom em `Europe/Brussels`) × linhas de hora (mesma faixa `DEFAULT_START_HOUR`–`DEFAULT_END_HOUR`).
- Cabeçalho da coluna: dia da semana + número, clicável → muda `view` para `day` daquele dia.
- Eventos renderizados como blocos posicionados (top/height calculados a partir de `startTime`/`endTime`), com `StatusBadge` (paid/pending/error) usando `useDayAppointmentStatuses` adaptado para a semana (vou expor `useRangeAppointmentStatuses`).
- Sem horários "livres" desenhados (não chamamos free-slots aqui); slots vazios = grade vazia, e clicar numa célula vazia abre `/appointments/new` com `setStart()` para aquele horário/calendário (quando só 1 artista visível) ou para o início do dia (quando vários).

### 4. `MonthView`
- Calendário tipo "month grid" (6 linhas × 7 colunas), começando na segunda.
- Cada célula mostra **contagem por status** (ex: `3 ●` confirmados, `1 ⚠` pendentes) somando todos os artistas visíveis. Sem listar agendamentos um a um (não cabe na célula).
- Clique na célula → muda `view` para `day` naquela data.
- Setas `‹ ›` mudam de mês.

### 5. `src/lib/agenda-grid.ts`
- Adicionar helpers utilitários:
  - `brusselsWeekStartMs(date)` / `brusselsWeekEndMs(date)` (segunda 00:00 → segunda+7 00:00).
  - `brusselsMonthStartMs(date)` / `brusselsMonthEndMs(date)` (1º do mês → 1º do próximo).
  - `enumerateDays(startMs, endMs)` retornando `Date[]` em Bruxelas.
- Sem alterar a lógica de `buildDayGrid` existente.

### 6. `src/hooks/use-agenda-status.ts`
- Generalizar para `useRangeAppointmentStatuses(startMs, endMs, enabled)` que a função atual reusa internamente para o caso "dia". Mantém a `queryKey` baseada no range.

### 7. i18n (`pt/en/fr`)
- `agenda.view.day`, `agenda.view.week`, `agenda.view.month`.
- Sem mexer em outras chaves.

## Fora deste plano
- Drag-and-drop de eventos.
- Edição de evento ao clicar (continua somente leitura).
- Filtro por artista na visão semana/mês (admin vê todos os ativos; tatuador vê só ele — igual hoje).
- Performance otimizada para meses com muitos eventos (no nosso volume atual não é problema; se for, adiciono virtualização depois).

## Validação
- Build + tsgo limpos.
- Verificar `/agenda?view=week` e `/agenda?view=month` no preview.
- Confirmar que o role artist continua vendo só o próprio calendário nas 3 visões.
