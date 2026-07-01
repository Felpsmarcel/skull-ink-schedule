
## Objetivo
No mobile (≤640px), o dashboard da Agenda hoje mostra várias colunas de tatuadores lado a lado com `min-w-[120px]`, obrigando scroll horizontal e deixando nomes/cards apertados e cortados. Vamos reorganizar o layout apenas em mobile, sem mexer em desktop nem em lógica de dados.

## Mudanças (somente `src/routes/_authenticated/agenda.tsx` + `src/lib/agenda-grid.ts` se necessário para nada além de larguras)

### 1. Escolha de "coluna ativa" no mobile (Day view)
- Em `< sm`, em vez de renderizar todas as colunas de artistas ao mesmo tempo, mostrar **uma coluna por vez**, ocupando 100% da largura útil (menos a coluna de horas).
- Adicionar um seletor horizontal rolável (chips) acima da grid com o nome curto de cada artista + contagem (`3 · 12`).
  - Estado local `activeStaffId` no `DayView`; default = primeiro artista (ou o do usuário se `restrictArtistId`).
  - Chip ativo: fundo `foreground`, texto `background`. Inativo: borda hairline.
- Em `sm:`+ manter o comportamento atual (todas as colunas visíveis, sem chips).

### 2. Dimensionamento das colunas
- Trocar `COL_WIDTH = "min-w-[120px] basis-0 grow"` por classes responsivas:
  - Mobile: `w-full` (coluna única ocupa todo o espaço).
  - `sm:` em diante: `sm:min-w-[140px] sm:basis-0 sm:grow` (comportamento atual).
- Coluna de horas: reduzir de `w-14` para `w-10` no mobile (`w-10 sm:w-14`) e diminuir a fonte para `text-[9px] sm:text-[10px]`.

### 3. Cards de eventos legíveis no mobile
- Nos cards renderizados dentro de `StaffColumn` (bloco de evento):
  - Padding `p-1.5 sm:p-2`.
  - Título: `text-[11px] sm:text-[12px] font-semibold`, `line-clamp-2`.
  - Faixa de horário: `text-[10px]` com `tabular-nums`.
  - Esconder `StatusBadge` quando a duração < 60 min (já existe lógica parcial; garantir threshold no mobile em 45 min).
  - Rail lateral: manter, largura `w-1`.

### 4. Header e KPI ribbon
- Header: reduzir gap para `gap-2` no mobile, esconder o botão "Hoje" (já está `sm:inline-flex`), garantir que Tabs (`Day/Week/Month`) quebrem para linha própria quando não couberem: envolver em `w-full sm:w-auto` na Tabs e `justify-between` no wrapper.
- KPI ribbon: já é `flex-wrap`; reduzir `text-[11px]` para `text-[10px]` no mobile e ajustar `gap-x-4`.

### 5. Week/Month views
- Não afetadas por este ajuste (já são grids semanais/mensais). Apenas revisar se algum `min-w-` força overflow horizontal indesejado; se sim, trocar por `w-full` no mobile.

## Fora do escopo
- Alterações em hooks, queries, GHL ou payloads.
- Mudanças de design system, cores ou tipografia.
- Refatoração de `AgendaAppointmentSheet`.

## Validação
1. Preview em 390×844 (mobile atual do usuário): uma coluna por vez, chips no topo, sem scroll horizontal na grid.
2. Preview em 768px+: layout atual preservado (todas as colunas visíveis).
3. Clicar num card ainda abre o `AgendaAppointmentSheet`.
4. Trocar de artista pelos chips mantém o mesmo dia/hora selecionado.
