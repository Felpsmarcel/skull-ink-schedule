# Espelhar recebimentos reais no GHL (Faturas) — análise e plano, desativado

## Estado atual verificado (código vivo)

1. Pontos que criam recebimentos
- `src/lib/movimentacao.functions.ts` → `createMovimentacao` (links individuais `/movimentacao/$slug`), `createMovimentacaoManual` (admin), helper interno de insert → tabela `movimentacoes`.
- `src/lib/appointments.functions.ts` → `createAppointmentRecord` (sinal do agendamento grava `payments` type deposit, status `paid`, método `other`) e `registerAppointmentPayment` → tabela `payments`.
- `src/lib/booking.functions.ts` → orquestra contato/oportunidade/agendamento via `booking_operations`; não grava recebimento próprio além do fluxo de agendamento.
- `src/lib/projects.functions.ts` só lê `movimentacoes` (finanças do projeto).

2. Escrita no GHL hoje
- Só `movimentacoes` escreve no GHL, via `src/lib/movimentacao-ghl.server.ts`: Custom Object "Movimentação Financeira" (`POST /objects/{key}/records`), best effort, síncrono após o insert. Não usa Invoices nem Payments.
- `payments` (agenda) não escreve nada no GHL.

3. Autenticação/autorização
- `createMovimentacao`: sem `requireSupabaseAuth` — continua público, protegido apenas por slug; grava com service-role.
- `createMovimentacaoManual`, `registerAppointmentPayment`, `createAppointmentRecord`: exigem sessão; o pagamento da agenda confere admin ou artista dono, depois grava com service-role.
- `listRecentClients`, `listArtistsForSelect`, `listMovimentacoesHistorico`, `findMovimentacaoPage` também sem middleware (fora do escopo, registrar como risco).

4. Dados disponíveis
- `movimentacoes`: ghl_contact_id, ghl_opportunity_id, project_id, appointment_id, data_pagamento, valores por método (cartão/dinheiro/sumup/transferência), tipo, chave_idempotencia. Sem invoice_id.
- `payments`: amount_eur, method, paid_at, appointment_id, contact_id; sem ID GHL de contato direto (via appointment) e sem invoice_id.
- Moeda implícita EUR em ambos.
- Escopos do token (`GHL_TOKEN`): NÃO verificados. Não há leitura segura sem chamada ao CRM; verificar na etapa de ativação com GET inofensivo de faturas.

5. Confiabilidade
- Não existe outbox de pagamentos. Dedupe só por `chave_idempotencia` no Custom Object; `reprocessFailedMovimentacoes` faz retry manual; sem timeout explícito no fetch; falha não desfaz o insert.

## Fluxo proposto (desativado por padrão)

```text
lançamento (link/agenda/manual) -> status "informado"
   -> confirmação por admin autenticado -> "confirmado"
   -> mesma transação insere payment_mirror_outbox (1 linha por recebimento)
   -> worker (cron privado, lease/fencing) se flag ligada:
        localizar fatura existente do contato/oportunidade na subconta GF
        sem fatura -> fila "precisa de fatura" (sem criar/enviar)
        com fatura -> POST /invoices/{id}/record-payment (valor da parcela, data, método)
        grava resposta, idempotência por ID do recebimento
```

- Links públicos nunca espelham direto; só ficam informados/pendentes.
- Valor enviado = parcela recebida em centavos; nunca total do projeto, nunca 35%.
- Estorno: não espelhado nesta etapa (fila de revisão).
- Sem cobrança, e-mail, SMS, workflow, criação ou envio de fatura.

## Arquivos previstos (revisão, nada aplicado)
- `docs/sql/payment-mirror-outbox.review.sql` — tabela outbox, unique(source, source_id), status, attempts, lease, RLS admin.
- `src/lib/payment-mirror-core.ts` — mapeamento puro (centavos, método GHL, validações location/contato/fatura).
- `src/lib/payment-mirror.server.ts` — worker com transporte injetável, timeout, backoff, flag `PAYMENT_MIRROR_ENABLED` desligada.
- `src/lib/movimentacao.functions.ts` / `appointments.functions.ts` — ação "Confirmar recebimento" (admin) enfileirando; manter custom object como está.
- Tela em Configurações: fila e motivos (sem fatura, ambíguo, falha).
- `tests/unit/payment-mirror.test.ts`.

## Testes (transporte simulado, dados sintéticos)
- Repetição do mesmo recebimento envia uma vez; timeout repete sem duplicar.
- Duas parcelas do mesmo projeto enviam valores próprios.
- Sem fatura / várias faturas candidatas → fila, sem POST.
- Location diferente, contato divergente, valor inválido → falha, nada enviado.
- Link público sem confirmação → nunca enfileira.
- Flag desligada → worker não chama transporte.

## Dependências para ativar
- Aprovação para aplicar a migração do outbox e da confirmação.
- Token com `invoices.readonly`, `invoices.write` (e `payments/transactions.readonly` para conferência), confirmado por leitura.
- Regra de qual fatura usar e quem cria faturas (criação automática não aprovada).
- Segredo privado do cron e homologação com uma fatura de teste aprovada.
- Decisão sobre proteger `createMovimentacao` e leituras públicas.
