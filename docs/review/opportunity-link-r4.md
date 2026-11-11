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

Vínculos são aditivos e únicos por oportunidade; a RPC não substitui contrato nem vínculo anterior. Distribuição tem controle de versão próprio. Ainda falta uma revisão comum entre decisões de vínculo e mudanças concorrentes de contrato, e a fixture não simula recarga durável de vínculos. Homologação visual desktop/mobile e autenticação real pendentes. Nenhum SQL ou mudança de CRM foi executado.

## Verificação local em 11/11/2026

- Bun: instalação com bun.lock congelado, scripts de instalação desativados. package-lock.json do npm está desatualizado; não foi reescrito.
- Vitest: 435/435 testes, 38 arquivos, exit 0; inclui 15 casos PGlite e 6 casos de fronteira do handler.
- TypeScript: tsc --noEmit, exit 0.
- ESLint dos arquivos alterados: formatação corrigida, exit 0.
- Build: exit 0; avisos de inputValidator depreciado existentes no projeto. Build não é deploy.
- SQL SHA-256: 2fb3ecb190fbda012e28d4a21bd269de0c43693e7125457133f37c38dd5d7f45.
