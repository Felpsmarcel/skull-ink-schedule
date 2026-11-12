# Revisão visual R7 — Financeiro e painel administrativo do tatuador

12/11/2026. Continuação do visual de Agenda e Projetos aprovado pelo usuário. Alterações na branch de revisão; sem merge ou publicação.

## Entrega

- FinanceView separa apresentação da consulta existente. Resumo, filtros, cartões no celular e tabela no desktop compartilham o sistema visual aprovado. Tatuador e vendedor recebem apenas campos de comissão no componente.
- Resumo identifica o conjunto retornado pelo sistema; filtros afetam somente a lista. Percentuais fixos 40/60 foram removidos. Valores registrados não foram recalculados. Zero real permanece zero; valor ausente ou inválido aparece como não informado.
- Períodos Hoje/Semana/Mês limitam início e fim no fuso Europe/Brussels; antes, o filtro tinha apenas limite inferior e incluía meses futuros. Semana começa na segunda-feira. Horário de verão coberto nos testes.
- Atribuição usa o ID: nome de lookup ausente não elimina o vínculo nem esconde a comissão do vendedor.
- ArtistPanelView apresenta hoje, futuros, projetos separados e continuidade. Fonte indisponível permanece diferente de lista vazia. Mantido o acesso exclusivo administrativo da rota e da fonte.
- Links de compromisso do painel levam a agenda ao dia civil de Bruxelas. A agenda aceita somente datas válidas e atualiza a URL ao navegar entre datas, removendo destaque de compromisso antigo.
- Tema claro aplicado também em /financeiro e /painel-tatuador, no prepaint e no efeito de navegação.

## Validação

- 447 testes em 40 arquivos passaram, incluindo limites de período, dias de 23/25 horas e datas civis válidas de links.
- TypeScript, ESLint dos arquivos alterados e build de produção local passaram. O build mantém avisos preexistentes de APIs de dependências; nenhum deploy foi executado.
- CUA no harness isolado /management.html: Financeiro e Painel sem overflow horizontal em 360, 390, 768 e 1440 px.
- Inspeção visual de desktop e celular; foco por Tab nos filtros e seletores. Regras existentes de reduced motion preservadas; preferência do sistema não foi alterada para esta validação.
- Financeiro: mês retorna 2 registros de novembro, dia retorna 1; sessão de dezembro excluída. Filtros por artista/vendedor e limpeza verificados; nome indisponível mantém comissão de 50 EUR fictícios.
- Modelos de tatuador e vendedor mostram somente sua comissão. Loading, vazio, erro/nova tentativa e indisponibilidade conferidos. Não é teste de login ou autorização do backend.
- Painel: 30 dias exclui o compromisso de 15/12; 60 dias o inclui. Artista B sem registros; indisponibilidade com null não vira zero; recuperação de erro e destino demonstrativo de data/ID conferidos.
- Revisão independente encontrou dois defeitos (atribuição sem nome e URL de data antiga); ambos corrigidos e rechecados.

Capturas no diretório local outputs/gf-studio-mvp-2026-11-11: finance-review-desktop-20261112.png, finance-artist-mobile-20261112.png, artist-panel-desktop-20261112.png, artist-panel-mobile-20261112.png. Somente exemplos fictícios.

## Limites e próxima etapa

O harness usa identidade administrativa fictícia e stubs que impedem execução de servidor. Os links de compromissos simulam o destino; o fluxo autenticado completo de abertura da agenda ainda exige homologação. Nenhum dado real, calendário, pagamento, oportunidade, SQL, função Supabase ou permissão foi alterado neste lote.

A consulta financeira existente não informa cobertura completa. “Pago” é classificação do sistema, que pode incluir definição manual; não comprova quitação ou repasse. Não se apresenta este painel como fechamento consolidado ou auditoria concluída. A regra de 35% em novembro e 40% a partir de dezembro ainda não foi conectada ao cálculo de produção; os valores existentes foram preservados.

O painel do tatuador continua administrativo até a revisão de permissões. Permanecem para revisão visual os fluxos de novo agendamento, check-in, fotos e detalhes, além das grades conectadas e homologação autenticada. Continuar na mesma PR, sem publicar automaticamente.
