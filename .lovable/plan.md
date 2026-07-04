# App mais fluido no mobile (iPhone-first)

Foco: **Agenda + fluidez de base + PWA instalável**, priorizando os três atritos que você marcou (registrar pagamento, ver "a receber", criar agendamento com cliente conhecido).

Não é redesenho visual — é comportamento, densidade e polimento nativo-like. Vou entregar em **3 fases**, cada uma independente. Você aprova uma por vez.

---

## Fase 1 — Base iPhone-like (fundação para tudo o resto)

Sem isso as próximas fases parecem "site em telefone".

1. **PWA instalável** (sem offline, conforme pediu):
  - `public/manifest.webmanifest` com nome, `display: standalone`, theme/background color, ícones 192/512 e maskable.
  - Meta tags no `__root.tsx`: `apple-touch-icon`, `apple-mobile-web-app-capable`, `theme-color`, `viewport` com `viewport-fit=cover`.
  - Ícones gerados a partir do logo atual (fundo escuro do studio).
  - Sem service worker.
2. **Safe area do iPhone** (notch/Dynamic Island + home indicator):
  - `env(safe-area-inset-*)` no `bottom-nav`, headers sticky e FAB "+".
  - `body { min-height: 100dvh }` (troca `100vh` que dá o famoso corte).
3. **Sem zoom acidental em inputs iOS**:
  - Regra global: inputs com `font-size: 16px` (Safari só evita zoom acima disso).
4. **Feedback tátil e press-states**:
  - `active:scale-[0.97] transition-transform` nos botões primários e cards clicáveis.
  - Helper `haptic()` chamando `navigator.vibrate(10)` em: abrir sheet do agendamento, confirmar pagamento, salvar novo agendamento. (No-op onde não suportado — Safari iOS ignora silenciosamente, sem quebrar.)
5. **Skeletons em vez de spinners** nas listas principais (agenda, financeiro, serviços) — percepção de velocidade.
6. **Transição de rota** curta (fade 120ms) — remove o "flash" branco.

---

## Fase 2 — Agenda mais fluida

Foco na tela mais usada.

1. **Swipe horizontal entre dias** (view Day):
  - Framer Motion `drag="x"` com snap + threshold; ao passar do limite, chama `nextDay()`/`prevDay()` já existente.
  - Setas ← → continuam funcionando.
2. **Header compacto e "sticky-shrink"**:
  - Ao rolar, o header (data + Day/Week/Month + chips de artista) encolhe para uma barra fina só com data + artista ativo. Ganha altura útil.
  - Chips de artistas com `snap-x` no scroll horizontal e o ativo se auto-centraliza.
3. **Long-press em slot vazio → novo agendamento naquele horário**:
  - 400ms de press → abre `/appointments/new` com `startISO` e `artistId` pré-preenchidos.
  - Um tap continua fazendo o que faz hoje.
4. **Pull-to-refresh** na agenda (react-use-gesture ou implementação leve com touch events) que dispara `queryClient.invalidateQueries(['agenda'])`.
5. **Botão "+" flutuante já existe** — vou aumentar target para 56px e adicionar sombra elevada + `active:scale`.
6. **Contadores dos chips** (`0·0`, `18·0`) — legenda discreta abaixo: "reservados · livres" (hoje é críptico).

---

## Fase 3 — Atalhos para os 3 momentos de atrito

1. **Registrar pagamento em ≤ 3 taps**:
  - No sheet do agendamento, mover "Registrar pagamento" para botão primário grande no rodapé fixo do sheet.
  - Dentro do formulário: 3 chips de valor rápido — **Total** · **Saldo** · **Metade** — que preenchem o campo. (Campo continua editável e vazio por padrão, como definido.)
  - Método "Dinheiro" fica pré-selecionado (mais comum). Tipo continua manual.
2. **Widget "A receber" sempre visível**:
  - No topo do Menu/Profile, card com valor **A receber hoje** e **A receber total** (usa `useFinanceSummary` que já existe).
  - Toque no card → abre `/financeiro` com filtro `bucket=a_receber` já aplicado.
3. **Cliente conhecido em 1 tap**:
  - No `/appointments/new`, seção Client, mostrar **"Recentes"** — últimos 5 clientes atendidos pelo artista logado (query nas `appointments` mais recentes).
  - Tap em um recente pula o autocomplete do GHL.

---

## Detalhes técnicos

**Dependências novas:** apenas `framer-motion` (leve, ~30KB gz) para swipe/drag. Nada mais.

**Arquivos principais afetados:**

- Fase 1: `public/manifest.webmanifest` (novo), `public/icons/*` (novo), `src/routes/__root.tsx`, `src/styles.css`, `src/components/layout/bottom-nav.tsx`, novo `src/lib/haptics.ts`, novo `src/components/ui/skeleton-*.tsx` (usar shadcn existente).
- Fase 2: `src/routes/_authenticated/agenda.tsx`, `src/hooks/use-agenda.ts` (invalidação para pull-to-refresh), `src/lib/agenda-grid.ts` (long-press).
- Fase 3: `src/components/agenda-appointment-sheet.tsx` (chips de valor rápido + rodapé fixo), `src/routes/_authenticated/menu.tsx` (widget), `src/routes/_authenticated/appointments.new.index.tsx` (recentes), nova server fn `listRecentClients` em `src/lib/appointments.functions.ts`.

**Sem alteração em:** cálculo financeiro, sync GHL, autenticação, banco de dados (fase 3 só lê tabelas existentes).

**Fora do escopo desta rodada:** offline real (precisa service worker + estratégia de sync), notificações push, arrastar agendamento para remarcar (drag-and-drop de eventos exige refazer o grid).

---

## Como quer prosseguir?

Sugiro implementar **Fase 1** primeiro (é o que muda a sensação geral e habilita a instalação no iPhone). Depois você testa 1-2 dias no seu iPhone e me diz se seguimos com Fase 2 ou ajustamos. Se preferir, posso fazer as 3 de uma vez — só é uma mudança maior para revisar.  
**Fase 1** primeiro ok