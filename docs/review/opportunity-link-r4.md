# Vínculo de oportunidades — r4 local

Base: 29d84d8, branch codex/gf-project-opportunity-link. Não publicado.

O diálogo administrativo mostra contrato e oportunidade, exige decisão explícita para divergências, bloqueia cliques repetidos e somente declara sucesso após resposta. Lost/Abandoned são históricos. A demonstração grava vínculos somente no componente, descartados ao sair/recarregar (não é persistência real).

A RPC de vínculo antes permitia execução por authenticated com snapshot GHL fornecido pelo chamador. O SQL de revisão agora permite somente service_role; o handler confere administrador, flag, contato e releitura completa do CRM antes de usar o cliente servidor. p_actor vem do contexto autenticado e o banco verifica seu papel. O payload público não aceita ator nem snapshot CRM. Não se trata de conceder acesso a usuários: a função privilegiada fica inacessível ao cliente.

## Ativação ainda pendente

- Revisar docs/sql/project-session-allocation.review.sql e testar em staging com esquema real, identidade e duas contas distintas.
- Confirmar que nenhuma versão anterior da RPC foi aplicada. A assinatura mudou: se houver função antiga, revogar/remover sua execução antes de ativar. Este arquivo não é uma migração incremental.
- Configuração exclusivamente servidor: PROJECT_ALLOCATION_PERSISTENCE=enabled. Continua desligada por padrão. Credencial service_role apenas no servidor existente; nunca expor ao frontend.
- Somente depois da revisão, autorização e homologação aplicar a migração e liberar flag.
- Reversão operacional: desabilitar flag, reverter código por commit normal; preservar tabelas e histórico. Não apagar registros.

## Limites

Vínculos são aditivos e únicos por oportunidade; a RPC não substitui contrato nem vínculo anterior. Distribuição tem controle de versão próprio. O vínculo agora compara o contrato exibido com o atual, no handler e sob bloqueio da linha no banco, antes de inserir. Isso rejeita decisão baseada em valor desatualizado; não impede alterações posteriores do contrato nem detecta alterações intermediárias que retornem ao mesmo valor. A fixture não simula recarga durável de vínculos. A interface foi verificada com dados sintéticos; autenticação real e homologação integrada em staging continuam pendentes. Nenhum SQL ou mudança de CRM foi executado.

## Verificação visual em 12/11/2026

- Harness isolado em tests/visual: componentes reais, dados fictícios e funções de servidor substituídas por bloqueios explícitos. Sem autenticação ou conexão com CRM.
- Mobile 393 × 852 e desktop 1280 × 900: diálogo legível, sem transbordamento horizontal (scrollWidth igual à largura).
- Divergência 900/3000: confirmar desabilitado até a decisão explícita de preservar contrato; cancelar e reabrir mantém a decisão desmarcada.
- Confirmação simulada mantém contrato 3000 e recebimentos 450; novo envio da mesma oportunidade fica desabilitado. Recarga descarta o vínculo simulado.
- Valores iguais: confirmação disponível sem decisão de divergência. Escape fecha e devolve foco ao botão de abertura.
- Status e botão acessível de fechar em português; diálogo limita altura e permite rolagem interna.
- Vitest novamente 435/435 (38 arquivos); TypeScript, ESLint dos arquivos alterados e build aprovados. Avisos de inputValidator preexistentes permanecem.

As capturas desta verificação ficam no diretório local de outputs/gf-studio-mvp-2026-11-11, arquivos opportunity-link-mobile-20261112.png e opportunity-link-desktop-20261112.png. Elas não comprovam integração ou persistência real.

## Verificação local em 11/11/2026

- Bun: instalação com bun.lock congelado, scripts de instalação desativados. package-lock.json do npm está desatualizado; não foi reescrito.
- Vitest: 435/435 testes, 38 arquivos, exit 0; inclui 15 casos PGlite e 6 casos de fronteira do handler.
- TypeScript: tsc --noEmit, exit 0.
- ESLint dos arquivos alterados: formatação corrigida, exit 0.
- Build: exit 0; avisos de inputValidator depreciado existentes no projeto. Build não é deploy.
- SQL SHA-256: 2fb3ecb190fbda012e28d4a21bd269de0c43693e7125457133f37c38dd5d7f45.

## Proteção do contrato observado — 12/11/2026

O navegador envia expectedContractCents obrigatório (inclusive null explícito); esse campo é uma pré-condição, nunca o valor a gravar. A RPC compara com IS DISTINCT FROM após SELECT FOR UPDATE e retorna contract_changed. Marcar “manter contrato” não dispensa essa conferência. O erro orienta recarregar e revisar. A assinatura agora tem nove parâmetros; versões anteriores de sete/oito parâmetros precisam ser inventariadas e revogadas antes da ativação.

Testes novos: valor alterado após leitura, decisão keep_contract desatualizada, zero diferente de desconhecido e propagação do conflito da RPC pelo handler. SQL permanece exclusivamente para revisão. SHA-256 atual: 956db90df0c8f3b6f0dda9fc38ca646638960ff370ebd5c952ecd71d43ed2c95.

### Roteiro para homologação integrada

1. Identificar banco de staging separado e confirmar esquema real, sem importar clientes reais para testes públicos.
2. Inventariar assinaturas existentes da RPC; aplicar revisão em staging e verificar ausência de EXECUTE para anon/authenticated em todas as assinaturas de snapshot.
3. Usar contas de teste administrador e tatuador; administrador pode vincular, tatuador não pode ler/gravar vínculo administrativo nem obter valores brutos.
4. Abrir duas fichas do mesmo projeto; alterar o contrato na segunda e tentar vincular pela primeira. Deve retornar contract_changed sem inserir vínculo. Recarregar e revisar deve permitir nova decisão.
5. Conferir repetição, oportunidade em outro projeto, contato incorreto, leitura CRM incompleta e recarga de vínculos persistidos.
6. Conferir no banco contrato, recebimentos e repasses intactos. Registrar evidências antes de propor ativação. Ainda não executado em staging.
