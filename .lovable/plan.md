# Agenda — Semana e Mês com todos os tatuadores + avatares

Confirmado: o **calendário** de todos os tatuadores é visível para todos os usuários (inclusive artistas vendo colegas). Apenas **dados financeiros** de outros tatuadores continuam bloqueados — isso já é garantido pelo `financeiro.tsx` / RPCs; não mexemos.

## Escopo (somente `src/routes/_authenticated/agenda.tsx`)

Remover `restrictArtistId` das views **Semana** e **Mês** — passar sempre `artistId: null` para `useStaffRangeAgenda` nesses dois modos, para que artistas logados também vejam agendamentos dos colegas. Day view continua respeitando `restrictArtistId` (mantém o foco atual).

## Semana — linhas de tatuadores estilo GHL

Trocar o layout atual `[coluna de horas | 7 dias]` por `[sidebar de tatuadores | 7 dias]`:

```text
        Seg 30  Ter 01  Qua 02  Qui 03  Sex 04  Sáb 05  Dom 06
[👤 Ana ]  ██              ██              ██
[👤 Bru ]          ██              ██
[👤 Caio]  ██              ██                      ██
```

- Sidebar esquerda (`w-32 sm:w-40`): uma linha por artista com `<Avatar>` (usa `staff.avatarUrl` + fallback `staff.initials`), nome curto e contador `bookedCount` do dia/semana.
- Colunas: 7 dias no cabeçalho (já existente, mantido).
- Cada célula (linha do artista × dia): lista compacta empilhada dos eventos daquele artista naquele dia — card com faixa colorida `staff.color`, nome do cliente e horário `HH:mm`. Clique no card abre o `AgendaAppointmentSheet` (mesmo handler atual).
- Fonte de dados: iterar `agendas` (já vem por artista via `useStaffRangeAgenda`) em vez de `allEvents.flatMap`. Elimina a grade `WEEK_PX_PER_HOUR` (linhas de horas) na semana — ganha densidade e legibilidade em mobile.
- Mobile (`< sm`): sidebar reduz para `w-14` mostrando só o avatar (nome vira `title`/tooltip). Grade rolável horizontalmente se necessário (`min-w-[720px]`).

## Mês — mesma grade + pilha de avatares

Manter a grade 7×N atual. Dentro de cada célula de dia:
- Substituir o texto "N agendamentos" por uma **pilha de avatares** (`flex -space-x-2`) — um `<Avatar className="h-5 w-5 border border-background">` por artista com agendamento nesse dia, no máximo 3 visíveis + badge `+N`.
- Manter os `StatusBadge` (pago / a receber / pendente) no rodapé da célula.
- Ordenação dos avatares: pela ordem em `agendas` (estável).

## Fora do escopo

- Nenhuma mudança em Day view, hooks (`useStaffRangeAgenda`, `useArtists`), RLS, RPCs ou tabela `appointments`.
- Nenhuma mudança em `financeiro.tsx` — dados financeiros de outros artistas continuam protegidos pelas policies e pelo RPC `get_my_artist_appointments`.
- Sem alteração de cores/tokens do design system.

## Validação

1. Logar como artista → abrir `/agenda?view=week` → ver linhas de todos os artistas ativos, com os próprios agendamentos e os dos colegas.
2. `/agenda?view=month` → cada dia com agendamentos mostra avatares empilhados dos artistas envolvidos.
3. Day view inalterada (artista vê só a própria coluna).
4. `/financeiro` como artista continua mostrando só as próprias comissões (sem regressão).
