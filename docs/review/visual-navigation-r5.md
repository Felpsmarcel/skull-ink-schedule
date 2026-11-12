# Revisão visual — navegação e cabeçalhos

12/11/2026. Alterações na branch de revisão, sem publicação ou mudanças de CRM.

- AuthShell: duas linhas em tablets e uma linha a partir de 1280 px; acesso direto a Projetos; foco visível; controles com altura de 44 px.
- PageHeader: respeita altura da navegação fixa; títulos podem quebrar e ações podem ocupar nova linha.
- BottomNav: ocupa largura móvel disponível, inclusive aparelhos entre 448 e 639 px.
- Painel administrativo do tatuador: métricas em cartões com espaçamento e quebra de textos indisponíveis. Sem mudança de permissões, consultas ou cálculo.

## Evidência

Harness em tests/visual/chrome.html usa AuthShell, BottomNav e PageHeader reais com router em memória, identidade fictícia e autenticação bloqueada. Conteúdo dos cartões é ilustrativo; não é uma réplica funcional de cada rota.

Conferidos 360, 390, 640, 768 e 1440 px; scrollWidth igual à largura. Em 640 px a navegação tem 600 px e conteúdo 598 px. Durante rolagem desktop: barra termina em 72 px e cabeçalho começa em 72 px. Link Projetos funciona na prévia e sinaliza estado ativo; Tab exibe anel de foco. Regra global de movimento reduzido preservada, sem novas animações (não emulada nesta rodada). Viewport restaurado.

TypeScript e build passaram. ESLint sem erros; aviso preexistente de exportação cn no AuthShell. Sem nova bateria de testes de negócio: mudanças de apresentação.

Capturas locais: outputs/gf-studio-mvp-2026-11-11/navigation-mobile-20261112.png e navigation-desktop-20261112.png.

## Pendente

Conferir o painel completo com dados autorizados, grade real de agenda, lista de projetos/clientes, fotos, financeiro e estados de erro/vazio em cada rota. Esta rodada não conclui a revisão visual de todas as telas. Tema claro da prévia não amplia automaticamente as rotas do piloto em produção.
