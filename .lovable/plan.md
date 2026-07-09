## Objetivo
Corrigir problemas de safe-area e altura do rodapé fixo do wizard no iPhone, garantindo que nenhum conteúdo fique cortado atrás do rodapé/Home Indicator e que os alvos de toque cumpram os 44pt mínimos da Apple.

## Diagnóstico rápido

- **`WizardFooter`** usa `pb-[max(0.5rem,env(safe-area-inset-bottom))]` + `pt-3` + botões `h-11`. No iPhone com Home Indicator (~34px), a altura total fica ~92px, mas o layout pai reserva apenas `pb-24` (96px) — margem quase zero. Sem safe-area, o rodapé some parcialmente atrás do Home Indicator em landscape/PWA.
- **`WizardLayout`** aplica `pb-24` fixo, sem `env(safe-area-inset-bottom)`. Última seção do `revisao` e último slot do `agenda` ficam colados/cortados pelo rodapé.
- **`main` das etapas** usa `p-4`/`pb-4`/`pb-6`, ignorando o rodapé — no iPhone SE (viewport curto) o botão "Confirmar" do sinal fica atrás do CTA fixo.
- **Botões pequenos**: ícones `h-9 w-9` (36px) nos cards de contato/serviço/revisão estão abaixo dos 44pt recomendados; grabber do sheet e chevrons do stepper idem.
- **Header do wizard** já tem `pt-[calc(env(safe-area-inset-top)+0.75rem)]` — OK.
- **Stepper** tem chips `py-1` (~24px de altura) com toque pequeno; em telas ≤375px o texto trunca demais.
- **Inputs de preço/desconto** `h-9` (36px) na revisão são difíceis de acertar; ao focar, o teclado do iOS sobrepõe o rodapé fixo (não há `scroll-margin-bottom`).

## Mudanças propostas (apenas UI/CSS, sem lógica)

### 1. `src/components/appointment-wizard/wizard-footer.tsx`
- Definir altura consistente via CSS var no elemento: `style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}`, `pt-3`.
- Botões primário/voltar: `h-12` (48px) em vez de `h-11`.
- Botão voltar: `w-12` (quadrado 48×48) para toque cômodo.
- Adicionar sombra sutil `shadow-[0_-8px_20px_-12px_rgba(0,0,0,0.4)]` para destacar do conteúdo com scroll.
- Expor a altura via classe utilitária compartilhada (constante `WIZARD_FOOTER_MIN_H = 88` px) usada abaixo.

### 2. `src/routes/_authenticated/appointments.new.tsx` (WizardLayout)
- Substituir `pb-24` por `pb-[calc(env(safe-area-inset-bottom)+6.5rem)]` no wrapper `flex min-h-dvh`.
- Deixar apenas o wrapper responsável pelo espaço do rodapé — remover os `pb-*` redundantes das etapas.

### 3. Etapas (`cliente`, `agenda`, `servicos`, `revisao`)
- Remover `pb-4`/`pb-6` extras do `<main>` de cada etapa (o layout já cuida).
- `revisao.tsx`: adicionar `scroll-mt-4` em seções + `[&_input]:scroll-mb-24` global para reduzir sobreposição do teclado.
- `agenda.tsx`: aumentar grade de horários para `h-11` (44px) e `gap-2`.
- `servicos.tsx`: aumentar `Input` de preço para `h-10 w-24`, ícones de remover/reset para `h-11 w-11`. Cabeçalho sticky ganha `top-0` já ok.
- `cliente.tsx`: botão de trocar cliente `h-11 w-11`; itens da lista `min-h-14` (56px) para toque fácil.

### 4. `src/components/appointment-wizard/stepper.tsx`
- Chip: `py-1.5` (32px de altura mínima) + `min-h-9`.
- Em `≤360px`, esconder label textual e manter apenas o círculo com número (`hidden xs:inline` via `sm:` fallback: usar `hidden [@media(min-width:360px)]:inline`).
- Ajustar `px-3 py-2` do wrapper para `px-3 py-2.5` para respiro visual.

### 5. Ajuste iOS-specific em `src/styles.css` (mínimo)
- Adicionar regra global para inputs dentro do wizard: `.wizard-scope input:focus { scroll-margin-bottom: 6rem; }` — aplicada via classe `wizard-scope` no wrapper do WizardLayout. Isso evita que o input focado fique atrás do rodapé/teclado.

## Fora de escopo
- Refatoração do fluxo, mudanças no `AgendaAppointmentSheet`, cores/tema, i18n, lógica de negócio ou schema.
- Redesenho do stepper (só ajustes de tamanho/quebra).
- Correções em outras páginas que já receberam safe-area (agenda, financeiro, menu).

## Arquivos afetados
- `src/components/appointment-wizard/wizard-footer.tsx`
- `src/components/appointment-wizard/stepper.tsx`
- `src/routes/_authenticated/appointments.new.tsx`
- `src/routes/_authenticated/appointments.new.cliente.tsx`
- `src/routes/_authenticated/appointments.new.agenda.tsx`
- `src/routes/_authenticated/appointments.new.servicos.tsx`
- `src/routes/_authenticated/appointments.new.revisao.tsx`
- `src/styles.css` (uma única regra utilitária)

## Verificação
Após implementar, abrir Playwright em 390×844 (iPhone 14) e 375×667 (iPhone SE), capturar cada etapa e confirmar que:
1. O rodapé nunca sobrepõe conteúdo scrollável no final.
2. Todos os alvos de toque têm ≥44px.
3. Ao focar inputs de preço/sinal, o campo permanece visível acima do teclado.
