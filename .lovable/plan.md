
# Etapa 1 — Correções rápidas da Agenda Mobile

Todas as mudanças são de UI/UX na agenda. Nenhuma regra de negócio, integração GHL, financeiro ou schema é tocado.

## Arquivos alterados

- `src/routes/__root.tsx` — adicionar `<Toaster>` global (uma única vez).
- `src/routes/_authenticated/agenda.tsx` — todas as demais mudanças abaixo.

## 1) Toaster global e remoção do duplicado

- Em `__root.tsx`, dentro de `RootComponent`, montar `<Toaster theme="light" position="top-center" offset="calc(env(safe-area-inset-top) + 0.5rem)" mobileOffset="calc(env(safe-area-inset-top) + 0.5rem)" />` uma vez.
- Em `agenda.tsx`, remover o import `Toaster` (L47) e o bloco `<Toaster ... />` (L161–166). As notificações de outras rotas (menu, admin, onboarding) continuam com seus próprios Toasters — não serão alteradas nesta etapa (fora do escopo).

## 2) Botão "Hoje" visível no mobile

Em `agenda.tsx` L219–225: substituir `className="ml-1 hidden ... sm:inline-flex"` por uma versão compacta sempre visível:

```
"ml-1 inline-flex shrink-0 rounded-full border border-border bg-card px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:border-foreground hover:text-foreground sm:px-3"
```

Fica ao lado das setas (posição atual no header). O onClick já é `setDate(new Date())`.

## 3) Cabeçalho mobile mais enxuto (Semana/Mês em menu)

Na `<Tabs>` L228–253:

- Manter as três tabs (`day/week/month`) apenas em `sm:` (adicionar `hidden sm:block` ao wrapper Tabs).
- No mobile, adicionar ao lado do "Hoje" um `<Popover>` compacto com botão-ícone (`MoreHorizontal` já disponível em lucide) que abre um pequeno menu com dois botões: "Semana" e "Mês". Ao clicar, chama `setView("week")` / `setView("month")`.
- A view "Dia" é o default no mobile e continua controlada pela URL search; não precisa de tab visível quando já está em Dia. Se o usuário estiver em week/month via URL, mostrar um chip "← voltar ao Dia" no mesmo local.

Resultado: no iPhone o header cabe em uma única linha (setas · data · setas · Hoje · ⋯).

## 4) Coluna de horários mais legível no mobile

Em L451–459 (time column labels): trocar
```
"flex w-10 items-start justify-center border-b border-border/40 pt-1 text-[9px] font-medium tabular-nums text-muted-foreground sm:w-14 sm:text-[10px]"
```
por
```
"flex w-12 items-start justify-center border-b border-border/40 pt-1 text-[10px] font-medium tabular-nums text-muted-foreground sm:w-14 sm:text-[11px]"
```

Ganho de 2px de largura e +1px de fonte. Os cards continuam ocupando `flex-1` das colunas de artistas — a redução é marginal.

## 5) Destaque do próximo atendimento (badge "PRÓXIMO")

Em `DayView`:

- Calcular `nextEventId: string | null` — o primeiro `slot.ghlEventId` do dia atual (mesma checagem `brusselsDayKey(now) === brusselsDayKey(date)`) cujo `slot.isFirstSlot === true` e `slot.eventStartMs ?? slot.startMs > Date.now()`. Considerar todas as `agendas` juntas e escolher o de menor `startMs`. Se hoje não estiver visível, `null`.
- Passar `nextEventId` para `StaffColumn` → `SlotCell`.
- Em `SlotCell`, se `slot.ghlEventId === nextEventId`, renderizar dentro do card, no canto superior direito, um pequeno badge:
  ```
  <span className="absolute right-1 top-1 rounded-sm bg-foreground px-1 py-[1px] text-[8px] font-black uppercase tracking-widest text-background">
    PRÓXIMO
  </span>
  ```
- Sem animação. Apenas um card por vez recebe o badge (garantido pelo id único).

## 6) Auto-scroll inteligente do modo Dia

Em `DayView`:

- Adicionar `const scrollRef = useRef<HTMLDivElement | null>(null)` no container `<div className="h-full overflow-auto">` (L445).
- Adicionar `const didAutoScrollRef = useRef(false)` e `const userScrolledRef = useRef(false)`.
- Registrar `onScroll` no container que marca `userScrolledRef.current = true` (só depois do primeiro auto-scroll — para não invalidar a si mesmo, comparar timestamp: só marca se `Date.now() - autoScrollAt > 400ms`).
- `useEffect` disparado quando `rowCount > 0 && !didAutoScrollRef.current`:
  - `targetPx = (nextEventTopPx ?? nowTopPx)`; onde `nextEventTopPx = ((eventStart - dayStartMs)/60000/SLOT_MINUTES) * ROW_HEIGHT_PX`.
  - Se ambos `null` (dia futuro, sem eventos), não faz nada.
  - `scrollRef.current.scrollTo({ top: Math.max(0, targetPx - 80), behavior: "auto" })`.
  - Marca `didAutoScrollRef.current = true` e `autoScrollAt = Date.now()`.
- Ao mudar `date` (via effect com `[date]`), zerar ambos os refs para que o próximo dia carregado também role uma vez.

## Critérios de conclusão / testes

- Simular manualmente via ajuste de viewport (375, 390, 430 px) usando `preview_ui--set_preview_device_viewport` na etapa de verificação; conferir:
  - "Hoje" clicável no header.
  - Menu compacto Semana/Mês abre e navega.
  - Coluna de horas legível sem quebrar cards.
  - Card "PRÓXIMO" com badge no topo.
  - Ao abrir Agenda, grade rola perto do próximo evento (ou "agora").
- Desktop (`sm:` breakpoints): comportamento atual preservado — tabs completas, "Hoje" com padding maior, coluna de horas em `w-14`.

## Riscos

- **Toaster global**: se alguma rota já monta seu próprio (menu, admin, onboarding), teremos dois Toasters em cascata. Sonner tolera múltiplos, mas os toasts podem duplicar. **Mitigação**: nesta etapa remover *apenas* o de agenda; consolidar os demais é escopo futuro.
- **Auto-scroll**: o container pode não ter altura própria em algumas viewports; se `scrollHeight === clientHeight`, a chamada é no-op — sem efeito colateral.
- **`nextEventId` global entre artistas**: o "próximo" é o mais próximo de qualquer artista; em estúdios com múltiplos tatuadores, cada um vê apenas um badge por dia (o mais próximo do estúdio). Aceitável para esta etapa; refinamento por "meu próximo" fica para a etapa "Minha agenda / Todos" persistente.
- **Popover no mobile**: garantir `z-index` acima do header sticky (usar `z-40`).

Após implementar, verifico com Playwright em 375/390/430 e reporto arquivos, resumo, riscos e resultados.
