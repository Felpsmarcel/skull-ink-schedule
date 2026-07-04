
# Ajustes no bloco Financeiro do agendamento

## Objetivo
Deixar o painel de pagamentos claro (Total, Pago, Falta) e evitar cadastros incorretos que geram saldo negativo como o do print (Total 1.000 €, Recebido 1.300 €, Saldo −300 €).

## O que muda

### 1. Formulário "Registrar pagamento"
- **Valor**: campo começa **vazio** (hoje vem pré-preenchido com o saldo).
- **Tipo**: dropdown manual com opções **Sinal / Final / Reembolso** (hoje é decidido automaticamente).
- **Método**: mantém como está (cash, transfer, card, etc.).
- **Data**: mantém como está.
- **Validação de overpagamento**:
  - Se `Pago + novo valor > Total`, mostra aviso amarelo dentro do formulário:
    *"Este pagamento excede o total em X €. Confirmar mesmo assim?"*
  - Botão "Salvar" fica desabilitado até o usuário marcar uma checkbox **"Confirmo o valor excedente"**.
  - Reembolso e valores dentro do total não disparam o aviso.

### 2. Grade de resumo (mantida, com destaques)
Mesmos 5 blocos de hoje: **Total · Sinal · Recebido · Saldo · Comissão** (+ Comissão vendedor quando existir).
Muda apenas a cor do bloco **Saldo / Saldo restante**:

| Situação | Rótulo | Cor do valor |
|---|---|---|
| `balance > 0` | "Falta a receber" | vermelho (`text-destructive`) |
| `balance = 0` | "Quitado" | verde (`text-emerald-600`) |
| `balance < 0` (overpago) | "Crédito do cliente" | âmbar (`text-amber-600`) com ícone de aviso |

### 3. Lista de "Pagamentos"
Sem mudança estrutural. Cada linha continua mostrando `Tipo · Método · Data · Valor`. Reembolso segue com sinal negativo.

## Detalhes técnicos

**Arquivos afetados:**
- `src/components/agenda-appointment-sheet.tsx`
  - `PaymentForm`: trocar `useState(String(suggestedAmount))` por `useState("")`; adicionar `<Select>` para `type` (default vazio, obrigatório); adicionar lógica de aviso de overpagamento + checkbox de confirmação.
  - `FinanceBody`: rótulo e cor dinâmica no bloco Saldo conforme tabela acima.
- `src/lib/appointments.functions.ts`
  - `registerAppointmentPayment`: aceitar `type` vindo do cliente (hoje é inferido). Manter fallback automático se o cliente não enviar (compatibilidade). Sem validação server-side de overpagamento — decisão é do usuário no cliente conforme escolhido.

**Sem migrações de banco.** Os campos `payments.type` e `payments.amount_eur` já existem e aceitam os três tipos.

**Sem alteração em:**
- Checkout de novo agendamento (sinal no momento da criação continua igual).
- Cálculo de comissão.
- Status manual, seller picker, edição de valor.

## Fora do escopo
- Corrigir automaticamente o agendamento do print (300 € a mais). Depois do deploy, você pode ajustar manualmente via "Reembolso" de 300 €, ou eu apago um dos pagamentos duplicados se preferir — me avise após aprovar o plano.
