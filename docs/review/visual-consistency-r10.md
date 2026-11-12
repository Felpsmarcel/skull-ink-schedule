# Continuidade visual — revisão R10

## Problema e resultado

A rota Saúde do sistema e outras páginas acessíveis pela Conta mantinham a identidade escura porque ficaram fora da lista do piloto visual. Todas as famílias de rotas de interface registradas passam a receber Papel & Petróleo, incluindo gestão, relatórios, recebimentos, onboarding e início. API, MCP e consentimento externo ficam fora dessa lista explícita.

O script anterior ao primeiro desenho e a navegação React usam o mesmo manifesto. O teste lê as declarações reais das rotas de interface para detectar futuras omissões, além de verificar paridade do script e limites dos prefixos.

## Apresentação

- Saúde do sistema usa um componente de apresentação puro com PageHeader, seis métricas existentes e incidentes com estado, severidade, ocorrências e datas. Mensagens originais permanecem visíveis; tipo/contexto técnico ficam em detalhes expansíveis.
- O flag degraded é exibido como Leitura parcial e impede afirmar Operação saudável ou Nenhum incidente ativo em uma leitura incompleta. Valores recebidos não são recalculados.
- Cabeçalhos de gestão, reconciliação, relatório de agendamentos, serviços e edição/manual de recebimentos usam o componente compartilhado, incluindo o deslocamento da barra desktop. Retornos contextuais são preservados.
- Avisos e formulário de recebimentos usam tokens da paleta; textos longos e filtros quebram em telas pequenas. A tela de Avaliações continua identificada como Em breve.

## Verificação

- 606 testes em 59 arquivos passaram, incluindo inventário de rotas e paridade do tema no carregamento direto.
- TypeScript, build de produção, lint funcional dos arquivos alterados e git diff --check aprovados. Lint funcional desabilita apenas formatação legada para não reformatar arquivos inteiros.
- HealthView no navegador: 360, 390 e 1440 px sem overflow horizontal; carregando, erro, retry, vazio e leitura parcial verificados. Detalhes técnicos abrem por teclado. Ações ficam desabilitadas durante processamento. Animação do refresh/skeleton possui alternativa para reduced motion; preferência do sistema não foi alterada.
- Harness /health.html claramente identificado com dados fictícios, sem conexão ao CRM. Um aviso de createRoot ocorreu durante hot reload enquanto o arquivo era editado; a recarga limpa não gerou novo aviso.

## Limites

Nenhum incidente foi reconhecido/resolvido em ambiente real. Não foram executados reprocessamentos, sincronizações, convites, pagamentos, alterações de permissões ou migrations. A revisão visual não resolve os incidentes operacionais nem comprova acesso/RLS de tatuador. Integração pelo GitHub atualiza a prévia; publicação do site é separada.
