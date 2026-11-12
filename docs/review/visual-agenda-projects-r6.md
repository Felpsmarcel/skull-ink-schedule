# Revisão visual — Agenda e Projetos

12/11/2026. Branch de revisão; sem publicação, alteração do CRM, SQL aplicado ou mudança de valores.

## Implementação

- AgendaToolbar extraído da rota: filtros responsivos, resumo de agendamentos, estado de leitura parcial/carregando e offset do cabeçalho igual ao da navegação. Controles Dia/Semana/Mês usam botões com aria-pressed. Calendário de escolha de data segue pt/fr/en com semana começando na segunda.
- AgendaBookingCard extraído: hierarquia de cliente, horário e descrição; nome acessível preserva os estados visíveis de próximo, sobreposição e pagamento. Mesma altura proporcional, IDs, callbacks e status recebidos.
- Semana móvel: o botão +N expande a própria célula do profissional/data e permite recolher. Não navega para o calendário de outro tatuador. Dias do mês possuem nomes acessíveis com data completa em Brussels, inclusive dias vazios.
- ProjectsView extraído: filtros com botão Buscar/Enter e limpar, cartões em duas colunas no desktop, área de tatuador a definir, continuidade, estados vazio/parcial e valores desconhecidos como A apurar. A lista do artista usa “Sua parte” sem impor o rótulo fixo de 35%. Cálculos e escopo continuam no servidor existente.
- A busca textual do backend continua limitada à página de 30 projetos retornada. O aviso agora explica esse limite; não foi implementada busca global nesta revisão.

## Verificação

O harness `tests/visual/operations.html` renderiza os componentes reais com dados fictícios, sem CRM. A grade diária ilustrativa e os diálogos locais não comprovam integração ou persistência.

- Agenda e Projetos conferidos em 360, 390, 768 e 1440 px, com scrollWidth igual à largura em todas as medições.
- Agenda: carregando/parcial, seleção de Randevu, cartão de orçamento, calendário em português, seleção de data e alternância dos controles de modo.
- Projetos: busca sem resultados, limpeza do campo, filtro por artista, explicação da lista parcial, valores nulos, perfil do tatuador sem saldo administrativo e abertura de cartão.
- Escape fecha o diálogo sintético e foco retorna ao cartão. Tab mostra anel visível. Movimento reduzido global preservado; não foi emulado nesta rodada.
- TypeScript, ESLint dos arquivos alterados e build passaram. 439 testes passaram em 38 arquivos. O build mantém avisos preexistentes de APIs depreciadas e configuração de paths.
- Revisão independente encontrou três regressões potenciais de acessibilidade/navegação; corrigidas e reavaliadas antes do commit.
- A prévia registrou erros transitórios durante a troca de módulos do Vite; o entrypoint agora desmonta a raiz ao ser descartado. Após recarga limpa e navegação Agenda → Projetos, nenhum erro novo no console.

Capturas locais em `outputs/gf-studio-mvp-2026-11-11/`: `agenda-review-mobile-20261112.png`, `agenda-review-desktop-full-20261112.png`, `projects-review-mobile-20261112.png`, `projects-review-desktop-20261112.png`.

## Limites e próxima retomada

Grades completas de agenda e a expansão semanal foram verificadas no código e compilação, mas ainda exigem exercício no app com dados autorizados. O harness de operações não carrega essas grades. A ficha conectada, fotos, financeiro, check-in, novo agendamento e painel completo do tatuador continuam pendentes de revisão visual integrada. Não considerar a revisão de todas as telas ou o MVP concluídos. O acesso do artista e a persistência real continuam sujeitos às restrições de homologação já registradas na PR.
