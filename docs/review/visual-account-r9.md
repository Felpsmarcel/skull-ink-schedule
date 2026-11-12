# Conta e gestão — revisão R9

A rota `/menu` passa a usar a identidade clara aprovada e grupos por função. A navegação chama a área de Conta; título e metadados usam Conta e gestão. O botão Sair do cabeçalho é suprimido somente nesta rota, que tem sua própria ação de saída com tratamento de erro.

## Comportamento

- Admin: Recepção, Financeiro, Equipe e acessos, Integrações. O registro de recebimento encaminha ao formulário administrativo; não assume um link de tatuador.
- Tatuador com vínculo: projetos, repasses, recebimentos e instruções de assistente. Vendedor com vínculo: comissões e recebimentos.
- Sem perfil ou vínculo: orientação. Erro e carregamento ocultam o conteúdo operacional, inclusive dados antigos em cache.
- Links pessoais são resolvidos pela associação explícita do usuário. Removido o fallback admin→Gabriel. A consulta do link inclui a identidade na chave do cache.
- O cartão identifica o responsável e descreve um formulário de registro de recebimentos. Endereços de prévia ficam identificados, com aviso de que podem gravar recebimentos reais; a prévia não é apresentada como sandbox financeiro.
- O formulário manual exige selecionar quem recebeu, inclusive na validação anterior ao envio. O vínculo explícito de links pessoais é preservado.
- O diagnóstico de sincronização permanece acessível por atalho. Não há novo selo de saúde, contador, data de sincronização ou estado de conexão inferido.

## Validação visual

Harness local `/account.html`: componentes reais com identidades fictícias e destinos em memória, sem consulta ao CRM ou gravação. Conferidos 360, 390, 768 e 1440 px sem overflow horizontal; uma coluna no celular e duas a partir de 768 px. Conferidos admin, tatuador, vendedor, perfil/vínculo ausente e erro/carregamento com identidade admin antiga no modelo; nesses estados não aparecem atalhos no conteúdo da conta.

Conferidos destino administrativo, expansão do endereço por Enter, foco visível por Tab e feedback de cópia simulado. Transições de 150 ms respeitam motion-reduce. Ensaio de apresentação não valida autenticação/RLS de tatuador.

## Limites

Não aplica migrations, não altera permissões, comissões ou dados financeiros, não aciona sincronização ou check-in e não publica o site. As telas de destino mantêm seus controles existentes. A revisão não certifica autorização dos endpoints legados: foi registrada uma pendência separada no fallback de papel de `getFinanceSummary`; ocultar atalhos não substitui revisar esse endpoint.

A leitura operacional atual transforma alguns dados ausentes em zeros. Por isso esta entrega não cria um resumo de status na conta; fornece acesso ao diagnóstico existente.

Validação final: 606 testes passaram em 59 arquivos; TypeScript e build de produção executados. A revisão independente encontrou o default manual de Gabriel e o alias www; ambos foram corrigidos e cobertos antes do envio. Estados do link sem vínculo/carregando/erro e retry também foram conferidos no navegador. Nenhum erro de console foi observado no harness.
