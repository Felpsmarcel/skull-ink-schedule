# Hoje no estúdio — revisão R11

## Problema e resultado

A tela Hoje tinha passado a receber a paleta clara, mas mantinha a composição antiga, estreita e com os blocos operacionais em uma única lista longa. A abertura direta e o trajeto Hoje → Conta → Hoje mantiveram `gf-ops-light` na inspeção real; o tema escuro da captura do usuário não foi reproduzido nessa sessão.

A apresentação foi extraída em HomeView e MyDayView para validar a tela completa com dados fictícios. Desktop usa agenda/chegadas como área principal e próximo cliente/atalhos/gestão na lateral. No celular, o próximo cliente vem antes da lista. Indicadores viraram cards, filtros têm seleção explícita e cada agendamento mantém separados situação na agenda, chegada e horários registrados.

A origem local e a cobertura não confirmada do GHL permanecem explícitas. Não é criada realização, venda ou ligação entre registros. Conflitos, cancelamentos e ausências continuam visíveis em todos os filtros, conforme a regra anterior. Sem dados, o resumo mostra indisponibilidade em vez de zeros ou ausência presumida de clientes.

O efeito do tema é reaplicado a cada pathname, inclusive entre duas rotas claras. É um reforço preventivo; não representa diagnóstico confirmado de perda da classe por hidratação.

## Validação

- 52 testes passaram nos arquivos home-dashboard, my-day, my-day-read e ops-light-theme.
- TypeScript e build de produção: saída 0.
- Fixture `tests/visual/today.html` com HomeView/MyDayView reais, dados sintéticos e destinos locais sem chamadas ao backend.
- Desktop 1440 e celular 390/360 px: sem overflow horizontal.
- Filtro Concluídos mantém o concluído e as três exceções da fixture. Fonte e cobertura abre por Enter.
- Estados loading, erro, stale, vazio, agenda indisponível e chegadas indisponíveis conferidos. Contagens indisponíveis continuam null e são rotuladas como indisponíveis.
- Durante atualização, o botão Atualizar Meu Dia fica desabilitado. Apresentação fictícia do artista não mostra a visão administrativa, recebimentos ou gestão; isso não substitui validação de permissões reais.
- Animações respeitam reduced-motion por CSS. Preferência do sistema não alterada.

## Limites

Queries, intervalos de atualização, funções de servidor, valores, permissões e destinos foram preservados. Não foram executados check-ins, sincronizações, pagamentos, convites, mudanças no CRM ou migrations. Publicação pública permanece separada da atualização da prévia. Acesso real do tatuador continua pendente de validação específica.
