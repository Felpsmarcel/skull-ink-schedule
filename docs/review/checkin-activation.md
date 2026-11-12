# Check-in e fila — revisão local, sem ativação

A apresentação usa componentes reais com dados fictícios em `tests/visual/checkin-demo.tsx`. Nenhum teste dessa prévia registra presença, envia mensagens ou chama o GHL. A leitura pública por token e os endpoints reais não foram exercitados contra produção.

## O que o código preparado faz

- Busca, confirmação de telefone e registro de chegada exigem sessão autenticada com papel `admin` antes de acessar o cliente privilegiado. O totem é supervisionado pela recepção; não está homologado para operação pública autônoma.
- Os últimos dígitos do telefone não são devolvidos como pista da validação. A lista de agendamentos válidos do dia é preservada, e mais de um resultado exige escolha na interface.
- O servidor relê contato e agendamento por ID; nomes, telefone, artista, horário e vínculo GHL de clientes existentes vêm dessas leituras. Data civil de Bruxelas usa intervalo semiaberto, inclusive nas transições de horário de verão.
- Leitura e alteração de fila exigem recepção. Alterações validam ID/estado, permitem somente transições de atendimento previstas e usam comparação do status observado no UPDATE. Uma resposta sem linha afetada é conflito, nunca sucesso.
- A fila não transforma loading/erro em zero nem trata nome ausente como ausência de atribuição. Estados finais não permitem concluir novamente.
- A tela final só mostra chegada registrada após leitura válida. Nenhuma mensagem afirma que a equipe ou o cliente foi notificado sem evidência.
- A sincronização usa apenas o ContactID GHL canônico e o EventID observado no agendamento local escolhido. Sem contato vinculado, a chegada local permanece registrada e a sincronização pede revisão. Não há busca do primeiro contato por telefone, criação automática de contato, seleção do primeiro evento do dia nem associação à primeira oportunidade.
- O workflow explícito de comunicação exige consentimento verdadeiro. Aceitação da chamada de workflow não é prova de envio/entrega; não preenche `notificado_em`. Falha nos campos, tag, workflow ou leitura da configuração não é declarada como sincronização concluída.

## Banco proposto — ainda não aplicado

`docs/sql/checkin-access.review.sql` é material de revisão com `ROLLBACK` ao final. Ele propõe:

- RLS restritiva de recepção/admin e substituição das políticas amplas conhecidas;
- execução da RPC de fila somente para identidade autenticada admin;
- escrita direta limitada às colunas de ciclo do atendimento, com inserção mantida no handler canônico;
- chave de unicidade por identidade do cliente + dia civil de Bruxelas + ID do agendamento. Agendamentos diferentes do mesmo cliente não são fundidos. Visita sem agendamento possui categoria própria;
- verificação de duplicados antes de substituir o índice, sem excluir registros.

**Ativação real para tatuadores permanece bloqueada.** O histórico de migrations contém políticas de check-in que permitem todo usuário com papel e uma RPC SECURITY DEFINER de escopo amplo. As condições atuais do banco não foram verificadas. Guardas de frontend e funções do app não protegem chamadas diretas se essas políticas continuarem aplicadas. O SQL de revisão precisa passar pela implantação autorizada e pelos testes de acesso em ambiente isolado antes dessa ativação.

## Limites que não viram garantia de produção

1. `next_checkin_codigo()` usa contagem + 1; dois registros simultâneos podem receber o mesmo código de exibição. O ID continua sendo a identidade. Um gerador transacional exige revisão separada.
2. A validação canônica lê contato/agendamento e depois insere. Uma mudança concorrente entre leitura e gravação requer uma transação/RPC com bloqueio para garantir a correspondência no instante da gravação.
3. A verificação de existência e o INSERT não são atômicos. O índice evita duplicado ativo; um conflito gera erro claro e pede conferência da fila. Não se declara replay bem-sucedido sem reler a mesma identidade.
4. O índice antigo cliente/dia, sem agendamento, impede segundo check-in ativo para outro agendamento. A proposta resolve isso apenas depois de aplicada; o código não afirma que o banco real já mudou.
5. Uma visita sem contato e sem telefone não possui chave suficiente para deduplicação confiável.
6. A RPC pública por token, seus privilégios e comportamento para token expirado não foram alterados nesta revisão. A UI esconde conteúdo expirado; isso sozinho não é uma proteção do banco.
7. A RPC da fila não expõe metadados de completude. A contagem na interface descreve a leitura recebida, não prova cobertura integral do banco.
8. Confirmar chegada no sistema real continua sendo uma gravação. Para contato GHL vinculado, a sincronização ainda escreve tag e campos operacionais mesmo sem consentimento de comunicação. Automações externas acionadas por essas mudanças podem enviar mensagens independentemente do workflow explícito: sua configuração, identidade/location e efeitos precisam de validação administrativa em staging antes de ativar este fluxo real. Os testes locais não comprovam envio, sincronização ou presença física.
9. Criação de novos contatos e resolução de identidade GHL exigem uma etapa separada, autorizada e validada. O vínculo local canônico não substitui verificação atual da identidade/location no CRM. Nenhum teste deste lote chamou o GHL ou exerceu a função de sincronização legada ao vivo.
10. A atualização do resultado da sincronização é best-effort e não transacional com o GHL. Falha na persistência desse resultado pode deixar o estado local pendente após um efeito remoto. Reprocessamento seguro e confirmação de entrega exigem integração própria; não repetir automaticamente um workflow por ausência de confirmação local.

## Validação executada

61 testes passaram em `checkin-policy`, `checkin-auth`, `checkin-status`, `checkin-access-sql`, `checkin-ghl-sync` e `checkin-confirm-sync`. O SQL foi executado exclusivamente em PGlite descartável, com dados sintéticos. Foram exercitados papéis, guardas antes de acesso privilegiado, datas de 23/25 horas, correspondência de IDs, transições finais, linhas ausentes, falhas de leitura/escrita, compare-and-set, RLS mesmo com política permissiva adicional, limites de dia, múltiplos agendamentos e unicidade. Os testes de sincronização usam `fetch` e banco simulados; verificam consentimento positivo/negativo, ausência de vínculo, falhas, preservação dos IDs selecionados e ausência de prova fictícia de entrega. Essa evidência não substitui a verificação do esquema, grants e automações reais.
