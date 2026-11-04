# Ativação futura do espelhamento — REVIEW, NÃO APLICADO

Este documento não configura cron, não aplica SQL, não altera variáveis e não autoriza lançamentos reais. A revisão deve ser incorporada e homologada antes da ativação. Não importar pagamentos antigos automaticamente.

## 1. Preparação e permissões

1. Incorporar o adapter corrigido e revisar/aplicar o SQL somente no ambiente autorizado. Confirmar os RPCs de confirmação, outbox, lease e conciliação; preservar os jobs existentes.
2. Comprovar o token da subconta GF `9iqrKUVPDddINb9S4Iwd` e os scopes `contacts.readonly`, `invoices.readonly`, `invoices.write` e `payments/transactions.readonly`. Permissão de calendário/oportunidade não cobre faturas.
3. Configurar somente no servidor: `GHL_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `PAYMENT_MIRROR_CRON_SECRET`. Gerar o último em gerenciador de segredos, aleatório, com pelo menos 32 caracteres. Não colocá-lo em código, URL, navegador, chat ou logs.
4. Manter `PAYMENT_MIRROR_ENABLED=false` e `PAYMENT_MIRROR_LIVE_MODE=false` durante a preparação. Não marcar um gate como comprovado apenas para conseguir executar o teste.

Gates reais, todos exigidos pelo worker:

| Variável | Evidência necessária antes de `true` |
|---|---|
| `PAYMENT_MIRROR_SCOPES_VERIFIED` | Token, subconta e permissões conferidos por leitura |
| `PAYMENT_MIRROR_CONTRACT_VERIFIED` | Contrato v3, unidades, campos obrigatórios e readback demonstrados em TEST |
| `PAYMENT_MIRROR_WORKFLOWS_REVIEWED` | Automações e efeitos de pagamentos manuais revisados |
| `PAYMENT_MIRROR_DRAFT_HOMOLOGATED` | Registro manual em fatura não enviada demonstrado em TEST |
| `PAYMENT_MIRROR_ENABLED` | Liberação final após as evidências e aprovação |

## 2. Homologação assistida em TEST (€1,23)

Executar a prova de contrato do adapter fora do job de produção, em ambiente de homologação autorizado, com base isolada e contato/projeto sintéticos. O modo TEST não dispensa verificar automações e destinatários. Se a conta não suportar registro manual em TEST, interromper; não substituir por um pagamento real para descobrir o contrato.

- [ ] Revisar workflows `Payment Received`, `Invoice Paid`, recibos, lembretes e integrações acionadas por faturas. Usar contato sem email/telefone reais; comprovar que não houve envio. Não desativar automações de clientes reais para viabilizar o teste.
- [ ] Criar projeto sintético de **€2,46**, com contato GHL exato. O preflight `GET /contacts/{id}` deve comprovar `contact.id` e `contact.locationId` da GF antes do POST. Contato estrangeiro ou incompleto: zero POST.
- [ ] Criar **uma fatura TEST**, `liveMode:false`, valor integral €2,46, sem desconto adicional, sem impostos/taxas não aprovados e sem destinatários. Confirmar que existe como `draft`. Não chamar `/send`, Text2Pay, cobrança de cartão ou auto-pay.
- [ ] Registrar **€1,23** por método manual comprovado. A hipótese do adapter é enviar `amount:1.23` para 123 centavos internos. Conferir na interface e no GET: pago €1,23, saldo €1,23 e transação €1,23. Não aprovar fator 100 apenas porque um mock passou.
- [ ] Demonstrar que o modo manual aceitou os campos de cartão/cheque ausentes, sem inventá-los, e que a fatura `draft` aceitou a parcela sem envio. Divergência: gate continua fechado.
- [ ] Conferir via lista paginada e **GET do detalhe da transação**: ID único, invoiceId correto, contato, location, EUR, 123 centavos, status de sucesso, `liveMode:false`, método e `meta.externalId` exato do recebimento. Sem marcador ou método comprovado: “A conciliar”, nunca sucesso presumido.
- [ ] Repetir a confirmação do mesmo recebimento: continuar com uma fatura e uma transação, sem novo POST. Registrar outra parcela sintética de €1,23 com ID distinto: mesma fatura, duas transações, total €2,46, saldo zero.
- [ ] Simular timeout/500 após aceitação, página incompleta e perda de lease com doubles offline: conciliar sem repetir POST; jamais contar conclusão cuja gravação foi rejeitada. Registrar as evidências dos testes independentes.
- [ ] Conferir data real do pagamento e histórico no GHL, sem presumir que data de criação da transação representa a data informada. Confirmar também ausência de emails/SMS e efeitos externos.

Após homologação, gravar as evidências e liberar os gates comprovados. Em produção, `PAYMENT_MIRROR_LIVE_MODE=true` é uma decisão separada e explícita; deixar `false` não representa sincronização de pagamentos reais concluída.

## 3. Scheduler novo, inicialmente desativado

Criar somente um novo job dedicado, por exemplo `GF Tattoo — payment mirror`; listar e preservar os agendamentos existentes. Usar scheduler capaz de executar **HTTP POST com cabeçalho secreto**, não um ping GET.

| Configuração | Valor a revisar |
|---|---|
| Destino | Domínio HTTPS do deployment homologado + `/api/public/payment-mirror-run` |
| Método | `POST` |
| Authorization | Bearer obtido do gerenciador de segredos; mesmo valor servidor de `PAYMENT_MIRROR_CRON_SECRET` |
| Corpo | Nenhum dado de cliente, pagamento, token GHL ou filtro de location |
| Cadência inicial | A cada 5 minutos, somente após aprovação |
| Concorrência/retries | Uma execução por vez; sem retries automáticos imediatos no scheduler |
| Logs | Status HTTP e contagens resumidas; ocultar cabeçalhos e dados pessoais |

O endpoint verifica segredo antes dos gates: segredo ausente/curto retorna 503; bearer ausente/incorreto retorna 401; bearer correto e gates fechados retorna `enabled:false`, sem instanciar store/transport. Testar esses resultados antes de habilitar o job. `enabled:true` não comprova que um pagamento foi conciliado.

Conferir o limite de duração do deployment/scheduler e o lease atual de 120 segundos, especialmente para lote de até 20 jobs. Não permitir que um timeout de infraestrutura seja tratado como sucesso. A recuperação deve ocorrer por lease/outbox e readback, não por repetição de um POST financeiro.

## 4. Liberação e interrupção

Após aprovação, liberar `PAYMENT_MIRROR_ENABLED` por último e habilitar apenas o novo job. Conferir os primeiros recebimentos futuros individualmente: uma fatura por projeto, uma transação por recebimento canônico, valor integral correto, comprovante/readback e ausência de mensagens.

“A conciliar”, divergência de método/ID/valor, 403 ou marcador ausente exigem revisão. Não apagar o outbox nem gerar outro ID para forçar nova tentativa. Para interromper, desabilitar o novo job e definir `PAYMENT_MIRROR_ENABLED=false`; preservar faturas, recibos, vínculos e histórico já gravados. Verificar qualquer chamada que já estivesse em andamento.

## 5. Identificação do estúdio para revisar

Leitura do perfil de empresa no GHL em 04/11/2026, na subconta GF: nome legal `GF tattoo Studio`; endereço `Chaussée de Ruisbroek 76, 1180 Bruxelles, Belgium`; fuso `Europe/Brussels`.

O worker lê `app_settings` com chave `studio_business` e valor `{name,address}`. Esses dados são candidatos de configuração para homologação; não foram gravados. Não foram inferidos VAT, impostos ou outras informações fiscais. Revisar os dados de faturação antes de criar qualquer fatura.
