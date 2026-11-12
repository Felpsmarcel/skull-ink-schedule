# Fotos, check-in e novo agendamento — rodada 8

Revisão local de 12/11/2026, mantida no PR em rascunho. Nenhuma publicação, migration, gravação de presença/agendamento/pagamento, envio de mensagem ou alteração de conta foi executada nesta rodada.

## Entrega no código

- Novo agendamento: apresentação consistente dos passos, data de Bruxelas por sessão, escolha explícita de projeto, estados de disponibilidade e revisão do total do projeto. Três sessões de €600 resultam em um projeto de €1.800; o valor global não é somado novamente. Valor ausente é distinto de zero explícito. A confirmação exige todas as datas e os valores necessários. A implementação atual mantém os mesmos serviços, artista e valor por sessão.
- Finalização: uma falha após sessões confirmadas preserva IDs e chaves no rascunho, informa conclusão parcial e bloqueia reenvio automático. Falha ao registrar o sinal não é declarada como pagamento confirmado. O campo informa que se trata de valor declarado como recebido, sem verificação de comprovante. Ver `../appointment-partial-finalization.md`.
- Check-in: seleção entre compromissos do mesmo cliente, consentimento opcional de comunicação, QR/estado público e fila com estados explícitos. O servidor exige recepção, relê as identidades canônicas e impede transições concorrentes/finais incorretas. A sincronização não escolhe o primeiro contato, evento ou oportunidade. As condições de ativação constam em `checkin-activation.md`.
- Fotos: galeria por projeto, revisão de tipo/legenda, ampliação, confirmação de remoção e estados de acesso/falha. Respostas antigas não atravessam projetos e URLs locais são liberadas. A integração real retorna ativação pendente: persistência remota ainda não está implementada. Ver `project-photos-activation.md`.

## Validação

- Suíte integral: 551 testes passaram em 55 arquivos. TypeScript e build local passaram.
- SQL de acesso exercitado apenas em PGlite efêmero, com identidades e registros sintéticos. Não comprova o estado do banco ou Storage reais.
- Harness `tests/visual/journey.html`: usa componentes reais com adapters/dados fictícios; não chama CRM, Storage, autenticação nem finalização real.
- Agendamento: conferidas troca independente da data/horário de cada sessão, revisão de três sessões, sinal somente na primeira, total de €1.800, ausência de valor com confirmação desabilitada e mensagem de simulação após finalizar. Larguras efetivamente observadas de 390 e 1440 px sem overflow horizontal; captura final em 1280 px.
- Check-in: conferidas escolha obrigatória entre dois compromissos, consentimento não obrigatório, estados ausente/expirado, QR e transições locais da fila. Larguras efetivamente observadas de 390 e 1440 px.
- Fotos: larguras observadas de 360, 390, 768 e 1440 px; ampliação/Escape com retorno de foco; falha de remoção mantém a foto; remoção local confirmada do projeto B preserva a foto do A; modo somente leitura esconde ações de escrita.
- A ferramenta de seleção de arquivo do navegador falhou em duas tentativas. A seleção real pelo file picker e o ciclo de envio não foram homologados. Não houve envio remoto de foto.
- A alteração posterior de viewport deixou de refletir a largura solicitada. Somente as dimensões efetivamente lidas foram contabilizadas; repetir uma solicitação de viewport não foi tratado como teste aprovado.

## Acesso real observado

A sessão indicada pela gestão continuou identificada na interface como **Admin**. Com essa conta foram lidas a lista de projetos e a agenda Randevu. A conta existente de tatuador não foi substituída, convidada novamente ou deslogada. Não se comprovou acesso de artista, isolamento entre artistas, gravação autenticada ou disponibilidade de todas as telas para esse papel.

## Antes de uso operacional

1. Implementar e homologar persistência privada de fotos, incluindo permissões por projeto, conteúdo do arquivo, idempotência e falhas parciais.
2. Revisar/aplicar as políticas de check-in em ambiente isolado; o SQL desta rodada permanece material de revisão com rollback. Conferir RPC pública por token, unicidade, automações GHL e escopo de location antes de operar o fluxo real.
3. Validar com uma sessão de artista real e outra identidade de teste os projetos próprios/alheios e a agenda Randevu. Acesso administrativo não comprova esses limites.
4. Exercitar agendamento e check-in completos em staging, inclusive falha após a primeira sessão e sinal informado. Os ensaios locais não criaram lançamentos reais.

Os valores oficiais e a comissão de produção não foram recalculados. A regra preparada de 35% em novembro e 40% a partir de dezembro continua dependendo da conexão/homologação do cálculo real já registrada na rodada anterior.
