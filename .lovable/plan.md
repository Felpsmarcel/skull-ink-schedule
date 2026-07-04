## Status do que foi implementado

Verifiquei os arquivos e sim, o essencial do plano anterior está implantado:

**Concluído**
- Coluna `services.price_on_request` + coluna `appointments.deposit_eur` (migração aplicada).
- Cadastro de serviço com opção "Preço sob consulta" e listagem mostrando "Sob consulta".
- Tela de seleção de serviços mostrando "Sob consulta" no lugar do preço.
- Draft (`appointment-draft.ts`) com `depositEur`, `overridePriceEur`, `linePriceEur`, `balanceEur`, `draftValuesComplete`.
- Checkout com:
  - Input "Valor (€)" por serviço sob consulta (bloqueia "Confirmar" enquanto vazio).
  - Campo "Sinal pago (€)" com "Saldo restante" e validação sinal ≤ total.
- `createAppointmentRecord` grava `deposit_eur` e, se > 0, cria linha em `payments` com `type = 'deposit'` (aparece no Financeiro).
- `useFinalizeAppointment` propaga `depositEur` para o servidor.

**Pendências reais (2 ajustes finos que não foram feitos)**

1. **Agenda sheet — linha explícita de Sinal/Saldo.** Hoje o `agenda-appointment-sheet.tsx` mostra Total / Recebido / Saldo e o sinal aparece dentro da lista de "Pagamentos". O plano pedia três linhas dedicadas (Total, Sinal, Saldo) quando `deposit_eur > 0`. Funciona, mas não está com o layout combinado.

2. **Registro de saldo na finalização.** O plano previa lançar automaticamente o saldo restante ao concluir o agendamento. Hoje o pagamento final continua manual (via "Registrar pagamento" no sheet). Como é manual, não há risco de cobrança em dobro — mas também não há automação. Precisamos decidir:
   - (a) manter manual como está (recomendo, dá mais controle ao operador), ou
   - (b) implementar lançamento automático do saldo ao mudar status para "concluído".

## Próximo passo proposto

Fazer só o ajuste (1) — adicionar linha "Sinal" e "Saldo restante" no sheet da agenda quando `deposit_eur > 0`, mantendo Total/Recebido/Comissão como estão. E confirmar com você se quer também o (2) automático ou se deixamos manual.

Confirma que quero seguir por aqui?
