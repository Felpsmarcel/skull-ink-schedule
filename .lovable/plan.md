## Objetivo

Tornar `WeekView` e `MonthView` mobile-first no `/agenda`, mantendo a barra lateral de avatares e os cards de agendamento sempre legíveis em telas ≤390px, sem alterar a lógica de dados (`useStaffRangeAgenda`, RLS, hooks) nem o Day view.

## Escopo

Somente `src/routes/_authenticated/agenda.tsx` — `WeekView` (linhas 700–873) e `MonthView` (877–1043). Zero mudanças em backend, hooks, tipos, ou no `financeiro.tsx`.

## Semana (WeekView)

Problema atual: grade `min-w-[720px]` força scroll horizontal, cada célula (7 colunas × N artistas) fica com ~40px de largura no mobile, cortando nome do cliente e hora.

Mudanças:

1. **Layout adaptativo por breakpoint**
   - Mobile (`< sm`): trocar a grade de 7 dias por um **carrossel horizontal por dia** — usar `Tabs` (shadcn) com uma aba por dia da semana (Seg 03, Ter 04, …) e mostrar somente 1 dia por vez. Ativa por padrão o dia atual (ou o dia selecionado via header do calendário).
   - Cada painel do dia lista os **artistas em linhas verticais empilhadas**, com avatar + nome à esquerda (largura livre, sem `w-32`) e a coluna de agendamentos ocupando o restante.
   - Desktop (`sm+`): mantém a grade 7 colunas × N artistas atual (comportamento inalterado).

2. **Sidebar de artistas no mobile**
   - Cabeçalho de cada linha de artista: `Avatar` 32px + `shortName` (visível no mobile também) + contador de agendamentos daquele dia. Usar `flex items-center gap-2 min-w-0` com `truncate` no nome.

3. **Cards de agendamento**
   - Mobile: cards em largura total do painel do dia (`w-full`), fonte `text-xs` (não `text-[10px]`), hora + cliente em duas linhas com `truncate`, badge de status inline.
   - Desktop: mantém compacto atual.

4. **Loading/empty states**: manter mensagens existentes, apenas ajustar padding.

## Mês (MonthView)

Problema atual: grid 7 colunas em 390px = ~52px por célula; avatares 20px + contador + 3 badges não cabem, sobrepõem.

Mudanças:

1. **Célula compacta no mobile**
   - Mobile: dentro de cada célula, mostrar apenas: número do dia + **um único indicador** — bolinha colorida no canto quando há agendamentos + contador total (`3`) em `text-[10px]`. Remover a fileira de avatares e as 3 badges de status separadas nesta viewport.
   - Adicionar um **dot color-coded** por status dominante (verde/amarelo/vermelho) no rodapé da célula.
   - Desktop (`sm+`): mantém avatares empilhados + badges como está hoje.

2. **Header dos dias da semana**
   - Manter `grid-cols-7`, mas usar iniciais de 1 letra no mobile (S T Q Q S S D) e `text-[9px]`, para não empurrar largura.

3. **Drill-down (já existe)**: tocar num dia continua abrindo o Day view daquele dia — no mobile essa é a forma principal de ver detalhes, então nenhuma info crítica se perde ao simplificar a célula.

## Detalhes técnicos

- Usar utilitários Tailwind responsivos já presentes no projeto (`sm:`), sem novos breakpoints.
- Reutilizar `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` de `@/components/ui/tabs` (já usado no arquivo — confirmar no import block; se não estiver, adicionar apenas o import).
- Padrão responsivo do design system (`responsive-layout-patterns`): todo container flex com texto usa `min-w-0`; avatares/ícones fixos usam `shrink-0`; nomes usam `truncate`.
- `restrictArtistId` continua ignorado (visibilidade total mantida).
- Nenhuma alteração em `useStaffRangeAgenda`, `useRangeAppointmentStatuses`, `AgendaAppointmentSheet` ou nas RPCs.

## Validação

- Preview em 390×844: Week mostra tabs de dias, um dia visível por vez, artistas em linhas legíveis, cards com nome + hora sem cortar.
- Preview em 390×844: Month cabe 7 colunas sem overflow horizontal, cada célula mostra dia + contador + dot de status.
- Preview em desktop (≥ sm): layouts atuais preservados sem regressão.
- Day view, header do calendário, filtros e navegação de datas: sem mudanças.
