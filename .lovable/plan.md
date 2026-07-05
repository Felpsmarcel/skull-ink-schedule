## Objetivo

Trocar a **Semana** mobile (rota `/agenda?view=week`) para o formato da segunda imagem: uma **grade artistas × 7 dias**, com avatar/nome do tatuador à esquerda, colunas por dia da semana, e cada agendamento renderizado como um **chip compacto de horário** dentro da célula do dia daquele artista.

Escopo: só o bloco mobile do `WeekView` em `src/routes/_authenticated/agenda.tsx` (bloco `sm:hidden`). Desktop e Dia/Mês permanecem iguais.

## Layout final (mobile, semana)

```
        seg 20  ter 21  qua 22  qui 23  sex 24  sáb 25  dom 26
      ┌───────┬───────┬───────┬───────┬───────┬───────┬───────┐
[JC]  │ 10:00 │       │       │ 10:00 │       │       │ 10:00 │
Joyce │       │       │       │       │       │       │       │
      ├───────┼───────┼───────┼───────┼───────┼───────┼───────┤
[AP]  │ 10:00 │       │       │       │ 11:00 │       │ 10:30 │
Andre │       │       │       │       │       │       │       │
      ├───────┼───────┼───────┼───────┼───────┼───────┼───────┤
[GF]  │       │       │       │ 11:00 │ 13:10 │       │ 11:00 │
Gabri │       │       │       │ 16:00 │       │       │       │
      │       │       │       │ 16:30 │       │       │       │
      └───────┴───────┴───────┴───────┴───────┴───────┴───────┘
```

- Coluna esquerda fixa (`sticky left-0`, ~56px): avatar redondo com anel na cor do artista + nome curto abaixo (2 linhas, `text-[10px]`).
- Cabeçalho superior fixo (`sticky top-0`): 7 colunas com dia da semana (`seg`, `ter`, …) + número; coluna do dia de hoje realçada; dias fora do horário/fim-de-semana com fundo listrado sutil (opcional).
- Célula (artista × dia): flex-col com chips empilhados verticalmente, ordenados por horário. Cada chip = botão pequeno com `HH:mm` (`text-[10px]`, `tabular-nums`) e um traço/fundo suave usando a cor do artista. Overflow vertical se >3 chips (mostrar `+N` compacto).
- Larguras: 7 colunas iguais dividindo o viewport (`grid-cols-[56px_repeat(7,minmax(0,1fr))]`), sem scroll horizontal em iPhone (390px → ~47px por dia, cabe 1 chip `10:00` por linha).
- Tap no chip abre o mesmo `AgendaAppointmentSheet` já usado (via `openFromEvent`).
- Tap em célula vazia: opcional — pré-preenche `draft` (calendar do artista, dia às 10:00) e vai para `/appointments/new` (mesmo padrão do slot livre do Dia). Confirmo abaixo.

## Mudanças técnicas

Arquivo único: `src/routes/_authenticated/agenda.tsx`, substituir o bloco `<div className="sm:hidden">` dentro de `WeekView` (linhas ~812–947) por:

1. Grid CSS com `grid-template-columns: 56px repeat(7, minmax(0,1fr))`.
2. Linha de cabeçalho (8 células): vazia + 7 dias, com `dayFmt`/`numFmt` já existentes; realce quando `key === todayKey`.
3. Para cada `agenda` em `agendas`: linha com célula de artista (Avatar + nome) + 7 células de dia. Para montar as células, pré-agrupar `a.events` em `Map<dayKey, GhlEvent[]>` ordenado por `startTime` (feito uma vez por artista via `useMemo`).
4. Chip = `<button>` compacto, `onClick={() => openFromEvent(ev, a.staff)}`, com `title` completo (`nome — serviço`). Usar `a.staff.color` como faixa lateral esquerda (`border-l-2`) e fundo `bg-muted/40`.
5. Manter `openEvent` state + `AgendaAppointmentSheet` já existente (nenhuma alteração fora do bloco mobile).
6. Remover o seletor de dia atual (`mobileDayKey`) do caminho mobile-week — deixa de ser necessário porque a semana inteira aparece. Estado e `useMemo` associados podem ficar (não incomodam) ou ser removidos junto.

Sem mudanças em: `use-agenda-range.ts`, `agenda-grid.ts`, componentes de sheet, dia/mês.

## Ponto para confirmar

Quando o tatuador tocar em uma **célula vazia** (artista × dia sem agendamento), o que fazer?

- **(a)** Nada (só chips clicáveis) — mais limpo visualmente, evita toques acidentais na grade densa.
- **(b)** Abrir novo agendamento pré-preenchido com aquele artista + aquele dia (hora padrão 10:00), igual ao "+" do slot livre do Dia.

Meu default seria **(a)** por causa da densidade em 390px; confirma?
