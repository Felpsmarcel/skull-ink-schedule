# Auditoria UX/UI Mobile — GF Tattoo

Análise de responsividade, iPhone, densidade e fluxos, com base nas rotas principais (`agenda`, `financeiro`, `appointments/new*`, `menu`, `auth`, `agenda-appointment-sheet`).

Nada foi alterado — este é apenas o diagnóstico e a ordem sugerida de correção.

---

## 🔴 CRÍTICO

### 1. Barra de navegação inferior conflita com o CTA flutuante
`BottomNav` fixo + `footer` também fixo com botão principal em `/appointments/new` e `/checkout`. No iPhone com safe-area, os dois se sobrepõem em telas curtas (SE/mini) — o CTA "Revisar/Finalizar" fica atrás do bottom nav OU o nav é encoberto. O `pb-20/pb-24` nas páginas é um valor mágico que não coincide com a altura real do nav + safe-area.

### 2. Header da Agenda quebra em telas estreitas (≤ 380px)
`header` da agenda usa `flex-wrap` com date-picker + Tabs (day/week/month) na mesma linha. Em 375px, as Tabs pulam para a segunda linha e ocupam largura total, deixando dois “andares” de header sob o notch. Somado à ausência de `pt-safe`, o título fica colado no relógio do iOS.

### 3. Grid da Agenda em week/month é feita para desktop
A coluna de horários é `w-10` (mobile) e 5–7 colunas de artistas em paralelo estouram a largura. O usuário precisa fazer scroll horizontal dentro de scroll vertical dentro do BottomSheet — gesto ambíguo em iOS. Slots com `h-14` × 20+ linhas geram uma tela extremamente densa.

### 4. Inputs numéricos do checkout/agenda-sheet minúsculos
`Input h-7 w-20 text-xs` para desconto %, valor, sinal — alvo <32px, abaixo do mínimo iOS HIG (44×44). Digitar preço no mobile abre teclado numérico mas o campo fica atrás do teclado (nenhum `scrollIntoView`).

### 5. `Sheet side="right"` no mobile ocupa 100% mas rola mal
O `SheetContent` da agenda ganha `pt-safe`, mas o corpo interno (`overflow-y-auto`) compete com o scroll do backdrop. Em iOS Safari isso trava em rubber-band e às vezes fecha o sheet sem querer. Além disso o sheet vem da direita — em mobile o padrão é bottom-sheet.

### 6. Fluxo de novo agendamento exige muitos toques
Sequência mínima observada: menu → agenda → + (nav) → cliente (sheet → busca → selecionar) → tatuador (select) → data (popover) → hora (grid) → serviço (rota nova → busca → item) → volta → checkout → sinal → finalizar. **~10–12 toques** para um caso trivial. Nada é pré-preenchido a partir do slot clicado na agenda.

---

## 🟡 MÉDIO

### 7. Financeiro — tabela desktop coexiste com cards mobile
Página envia 8 colunas de tabela (`sm:block`) e cards separados no mobile. Em mobile, cards têm 3 colunas de totais (`grid-cols-3`) com valores longos (`€ 1.234,56`) — quebra a linha e desalinha.

### 8. Chip de artistas na agenda com scroll horizontal sem indicação
`overflow-x-auto` esconde o scrollbar; não há gradient/fade nem indicador de que há mais artistas à direita.

### 9. StatCard usa cores fora do design system
`text-emerald-600`, `text-amber-600`, `text-destructive` hardcoded em vez dos tokens semânticos — quebra a paleta P&B do projeto e some no dark theme (que espelha o light por design, ok, mas os tokens continuam sendo o padrão).

### 10. Menu mobile duplicado com nav inferior
Bottom nav já tem Agenda / Financeiro / + / Menu. A página `/menu` repete "Meu financeiro" como Row — dois caminhos para o mesmo lugar. Também mistura "Em breve" (Notificações, Idioma) que ocupam espaço sem função.

### 11. Auth screen sem safe-area top
`min-h-dvh flex items-center justify-center` centraliza tudo, mas o logo em iPhone com notch pode encostar no status bar em orientação landscape.

### 12. Botão "+" flutuante do bottom nav sobrepõe conteúdo
`-mt-6 h-14 w-14` cobre parcialmente a última linha de listagens (financeiro, serviços) sem `pb` extra suficiente na página.

### 13. Popover Calendar em mobile
`PopoverContent align="center"` do date-picker pode sair da viewport em telas pequenas — não há detecção de mobile para virar Drawer/BottomSheet.

### 14. Serviços: header sticky com fundo semitransparente
`bg-card/80` sobre lista com scroll perde legibilidade quando um card cinza rola por trás.

### 15. Densidade tipográfica excessiva
Textos `text-[9px]`, `text-[10px]`, `text-[11px]` em muitos rótulos financeiros — abaixo do mínimo confortável mobile (12–13px). No iPhone 15 Pro Max ainda passa, no SE fica ilegível.

---

## 🟢 BAIXO

### 16. Toaster `position="top-center"` colide com status bar
Toasts aparecem sob o notch/relógio em iPhone.

### 17. Falta feedback de loading nos botões de CTA
`Registrar pagamento`, `Salvar` não têm spinner inline consistente — em conexões lentas o usuário toca de novo.

### 18. `active:scale-95` só no bottom nav
Falta haptic + micro-feedback nos cards da agenda e nas linhas de serviço (tocáveis) — parece “desktop clicável” em vez de app.

### 19. Placeholder vazio no financeiro é um card com borda tracejada
Aceitável, mas sem ilustração/CTA — sensação de “app quebrado” quando não há dados.

### 20. Nenhum `pull-to-refresh`
Padrão mobile esperado. Hoje só existe botão de "Sincronizar GHL" para admin, invisível para artist/seller.

### 21. Performance percebida
Financeiro carrega tudo (`useFinanceSummary` retorna `rows` completo) e filtra client-side. Sem paginação/virtualização — em contas com muitos agendamentos, o first paint atrasa.

### 22. Agenda week/month rende sempre 20+ linhas × N artistas
Sem virtualização (`@tanstack/virtual`). Custo alto de DOM em iPhones antigos.

---

## Ordem recomendada de correção

```text
Fase 1 — Fundamentos mobile (🔴)
  1. Safe-area consistente (pt-safe em todos os headers sticky, pb calc real do bottom nav)
  2. Alvos de toque: subir inputs numéricos p/ h-9/h-10, min 44px em ícones-botão
  3. Bottom nav vs footer CTA: unificar num único slot inferior (esconder BottomNav em telas de fluxo, ou embutir CTA na barra)
  4. Header da Agenda em 2 linhas propositais no mobile (data em cima, view switcher embaixo)
  5. Sheet lateral → BottomSheet no mobile (drawer via vaul); manter side=right só em sm+

Fase 2 — Fluxo de agendamento (🔴 #6)
  6. Tap no slot livre da agenda → pré-preenche staff+data+hora e vai direto ao passo "cliente"
  7. Wizard em 3 passos claros (cliente → serviço+valor → confirmar) com barra de progresso
  8. Serviços em bottom-sheet, não em rota separada — evita perder contexto

Fase 3 — Densidade e clareza (🟡)
  9. Substituir cores hardcoded por tokens (foreground/muted/destructive)
 10. Tipografia mínima 12px; totais financeiros em cards de 2 colunas no mobile
 11. Remover linhas "Em breve" do menu ou agrupar em "Configurações"
 12. Indicadores de scroll (fade lateral) nas chip-lists

Fase 4 — Polimento (🟢)
 13. Toaster position="top-center" com offset de safe-area
 14. Haptic + active:scale em cards da agenda e linhas de serviço
 15. Empty states com ilustração + CTA
 16. Pull-to-refresh nas listagens principais
 17. Virtualização da grid da agenda (week/month) e da tabela financeira
```

## Escopo desta auditoria

- Apenas análise; nenhuma linha de código foi alterada.
- Cobertura: `agenda`, `financeiro`, `appointments/new` (index/services/checkout), `menu`, `auth`, `AgendaAppointmentSheet`, `AuthShell`, `BottomNav`, `__root`.
- Não avaliado em profundidade: telas admin (`equipe`, `vendedores`, `reconciliar`, `relatorios`) — sinalizo como próximo passo se quiser incluir.

Aprove o plano para eu começar pela Fase 1, ou me diga quais itens priorizar/remover.
