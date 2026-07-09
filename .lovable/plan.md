# Wizard de Agendamento — Fluxo Guiado

Substituir a página única `/appointments/new` (tudo empilhado + checklist horizontal) por um wizard em 4 passos, um cartão por vez, com barra de progresso no topo e CTA fixo no rodapé. No desktop mantém layout de coluna larga; no mobile cada passo ocupa a tela.

## Fluxo dos passos

```text
1. Cliente  →  2. Tatuador + Data/Hora  →  3. Serviços  →  4. Revisão
   (contact)     (staff + slot)              (services)      (checkout)
```

- **1. Cliente**: buscar/criar contato. Avança automaticamente ao selecionar.
- **2. Agenda**: seletor de tatuador (auto-selecionado se `me.role==='artist'`, passo é pulado se só há 1 opção e já escolhida) + calendário + grade de horários. Avança ao tocar em um slot.
- **3. Serviços**: catálogo (busca + agrupado por categoria) com multi-seleção inline; edição de preço override/desconto por linha aqui mesmo — não precisa voltar para uma tela intermediária. Botão "Continuar" no rodapé.
- **4. Revisão**: resumo compacto (cliente/data/tatuador/serviços/total), campo de vendedor, sinal, notas, e botão **Confirmar agendamento**.

Regras:
- Cada passo só habilita "Continuar" quando válido; o CTA mostra o motivo pendente (reaproveitar `validateAppointmentDraft`).
- Botão "Voltar" no header não perde o draft (já persistido em `sessionStorage`).
- Barra de progresso (`Passo N de 4`) clicável para pular para passos já preenchidos.

## Estrutura de rotas

Substitui as 3 rotas atuais por uma pai + 4 filhas:

```text
/appointments/new             → redireciona para /appointments/new/cliente
/appointments/new/cliente     → Passo 1
/appointments/new/agenda      → Passo 2
/appointments/new/servicos    → Passo 3
/appointments/new/revisao     → Passo 4 (renomeado de /checkout)
```

Arquivos:
- `src/routes/_authenticated/appointments.new.tsx` — layout com header + stepper + `<Outlet />` + rodapé de navegação. Redireciona `/appointments/new` para `/cliente` se draft vazio, ou para o primeiro passo pendente se voltando.
- `src/routes/_authenticated/appointments.new.cliente.tsx` — extrai `ContactPicker` da index atual.
- `src/routes/_authenticated/appointments.new.agenda.tsx` — extrai bloco tatuador + calendário + slots da index.
- `src/routes/_authenticated/appointments.new.servicos.tsx` — reescreve a atual `services.tsx` para multi-seleção com editor de preço inline (mescla o editor que hoje vive na index).
- `src/routes/_authenticated/appointments.new.revisao.tsx` — renomeia `checkout.tsx`.

Arquivos apagados: `appointments.new.index.tsx`, `appointments.new.services.tsx`, `appointments.new.checkout.tsx` (conteúdo migrado).

## Componentes novos

- `src/components/appointment-wizard/stepper.tsx` — barra de 4 pontos com labels curtas (Cliente, Agenda, Serviços, Revisão); marca concluídos usando o mesmo checklist atual.
- `src/components/appointment-wizard/wizard-footer.tsx` — rodapé fixo com "Voltar" + CTA primário; label dinâmica igual ao `ctaLabel` atual.
- `src/hooks/use-wizard-step.ts` — deriva passo atual da rota, próximo passo pendente e helpers `goNext()`/`goBack()`.

## Detalhes técnicos

- Reutiliza `useAppointmentDraft` sem alterar o store (draft continua persistido em sessionStorage v4).
- `validateAppointmentDraft` continua fonte única de verdade para habilitar o CTA final; adicionar um helper `firstPendingStep(draft)` em `src/lib/appointment-draft-validate.ts` que mapeia razão → rota do passo.
- Recurrence (hoje desabilitado) sai do fluxo principal; ficará em "Revisão" como campo colapsado para não poluir o wizard.
- Todas as telas usam padding `pt-[calc(env(safe-area-inset-top)+0.75rem)]` e rodapé `pb-[max(0.5rem,env(safe-area-inset-bottom))]` já usados no projeto.
- i18n: adicionar chaves `appt.wizard.step1..4`, `appt.wizard.back`, `appt.wizard.next` em `pt.json`/`en.json`/`fr.json`.
- Links externos (agenda, botão "+ Novo") continuam apontando para `/appointments/new` — o layout redireciona.

## Fora de escopo

- Redesenho da grade de horários (item #3 da auditoria).
- Alterações no store ou na função server `createAppointmentRecord`.
- Alterações nas rotas admin ou no fluxo do checkout backend.
