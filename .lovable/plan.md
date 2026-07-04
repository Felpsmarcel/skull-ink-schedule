## Objetivo

1. Permitir servi\u00e7os "sob consulta" (sem pre\u00e7o fixo) que exigem digitar o valor no checkout.
2. Adicionar campo de sinal (dep\u00f3sito pago pelo cliente) no checkout, exibir no "Revisar agendamento" e registrar como pagamento parcial no Financeiro.

---

## Parte 1 \u2014 Servi\u00e7o sem pre\u00e7o fixo

**Cadastro de servi\u00e7os** (`/services`, admin)
- Novo checkbox "Pre\u00e7o sob consulta" no formul\u00e1rio de servi\u00e7o.
- Quando marcado, os campos "Pre\u00e7o (\u20ac)" e "Pre\u00e7o m\u00e1x" ficam desabilitados/ocultos e o servi\u00e7o \u00e9 salvo com `price_eur = 0` e uma flag `price_on_request = true`.
- Na listagem, servi\u00e7os sob consulta mostram "Sob consulta" no lugar da faixa de pre\u00e7o.

**Sele\u00e7\u00e3o de servi\u00e7o** (`/appointments/new/services`)
- Mostrar "Sob consulta" em vez de "300,00 \u20ac \u2013 500,00 \u20ac" quando `price_on_request`.

**Checkout / Revisar agendamento**
- Cada linha de servi\u00e7o sob consulta ganha um input num\u00e9rico obrigat\u00f3rio "Valor (\u20ac)" (aparece no lugar do pre\u00e7o fixo).
- Bot\u00e3o "Confirmar" fica desabilitado enquanto qualquer servi\u00e7o sob consulta estiver com valor 0/vazio.
- O total soma o valor digitado normalmente; desconto % continua funcionando sobre o valor digitado.

---

## Parte 2 \u2014 Sinal (dep\u00f3sito)

**Checkout**
- Novo campo "Sinal pago (\u20ac)" no bloco de totais, abaixo dos servi\u00e7os e acima do total.
- Layout do bloco de totais:
  - Total: 700,00 \u20ac
  - Sinal pago: 200,00 \u20ac
  - Saldo restante: 500,00 \u20ac  (destacado)
- Valida\u00e7\u00e3o: sinal \u2265 0 e \u2264 total.
- Bot\u00e3o inferior continua mostrando o total; o saldo restante aparece no bloco acima.

**Persist\u00eancia**
- Adicionar `deposit_eur numeric` em `public.appointments` (default 0).
- No draft (`appointment-draft.ts`), adicionar `depositEur: number` e persistir.
- Server fn `createAppointmentRecord` recebe `depositEur`, grava em `appointments.deposit_eur` e, se > 0, cria uma linha em `public.payments` com tipo `sinal`, valor = depositEur, na data de cria\u00e7\u00e3o.

**Financeiro**
- Ao finalizar o agendamento (concluir), a l\u00f3gica atual cria o pagamento do total. Ajustar `useFinalizeAppointment` / `finance.functions` para lan\u00e7ar apenas o **saldo restante** (`total - deposit`), evitando cobran\u00e7a em dobro. Se saldo = 0, n\u00e3o cria nova linha.
- Sinal aparece no Financeiro na data do agendamento; saldo aparece na data da finaliza\u00e7\u00e3o.

**Agenda / Sheet**
- Em `agenda-appointment-sheet.tsx`, mostrar tr\u00eas linhas: Total, Sinal, Saldo (quando `deposit_eur > 0`).

---

## Detalhes t\u00e9cnicos

**Migra\u00e7\u00e3o**
```sql
ALTER TABLE public.services      ADD COLUMN price_on_request boolean NOT NULL DEFAULT false;
ALTER TABLE public.appointments  ADD COLUMN deposit_eur      numeric(10,2) NOT NULL DEFAULT 0;
```
- Nenhuma altera\u00e7\u00e3o de RLS/policies (colunas em tabelas j\u00e1 protegidas).

**Arquivos alterados**
- `supabase/migrations/<novo>.sql`
- `src/lib/services.ts` + `src/lib/services.functions.ts` (aceitar/retornar `price_on_request`)
- `src/routes/_authenticated/services.tsx` (checkbox no form + label "Sob consulta")
- `src/routes/_authenticated/appointments.new.services.tsx` (label "Sob consulta")
- `src/stores/appointment-draft.ts` (adicionar `depositEur`, helper para valor livre por linha via `overridePriceEur?`)
- `src/routes/_authenticated/appointments.new.checkout.tsx` (input de valor livre, input de sinal, bloco de totais com saldo)
- `src/lib/appointments.ts` + `src/lib/appointments.functions.ts` (propagar `depositEur` e `overridePriceEur` por linha)
- `src/hooks/use-finalize-appointment.ts` + `src/lib/finance.functions.ts` (registrar sinal na cria\u00e7\u00e3o; lan\u00e7ar saldo na finaliza\u00e7\u00e3o)
- `src/components/agenda-appointment-sheet.tsx` (exibir sinal/saldo)

**Fora de escopo**
- Sem % padr\u00e3o de sinal, sem sinal por servi\u00e7o.
- Sem sobrescrever pre\u00e7o em servi\u00e7os que t\u00eam pre\u00e7o fixo (isso continua via desconto %).
- Sem mudan\u00e7as em GHL (o sinal fica local, o total continua indo para o GHL).
