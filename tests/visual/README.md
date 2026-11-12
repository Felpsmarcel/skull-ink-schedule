# Ficha sintética local

Execute na raiz do repositório:

```sh
node node_modules/vite/bin/vite.js --config tests/visual/vite.config.ts
```

Abra http://127.0.0.1:8784/. O harness usa os componentes reais da ficha com dados fictícios. Não lê arquivos de ambiente; funções de servidor são substituídas por stubs que rejeitam chamadas. Os vínculos simulados somem ao recarregar. Não é uma rota do app nem uma homologação da integração GHL.

Checklist manual: selecionar oportunidade divergente, verificar bloqueio de confirmação, cancelar/reabrir, confirmar preservação do contrato, verificar bloqueio de repetição, recarregar e conferir descarte. Repetir em 393 × 852 e 1280 × 900. Escape deve fechar o diálogo e devolver foco ao botão de abertura.

## Agenda e Projetos

Abra /operations.html no mesmo servidor. Usa AgendaToolbar, AgendaBookingCard e ProjectsView reais, alimentados somente com clientes, artistas, valores e horários fictícios. O router fica em memória. “Ver projetos” alterna para a lista; controles de teste alternam papéis e lista parcial. Os controles da agenda, calendário de escolha de data e cartões são reais; a grade é demonstrativa e não valida as grades conectadas de dia, semana ou mês. Cartões abrem diálogos locais de demonstração.

Checklist: 360/390/768/1440 px; filtro de tatuador, data, Dia/Semana/Mês; estados carregando/parcial; busca por Enter ou Buscar, limpar, status sem resultados, lista parcial, valores nulos, visão do artista sem saldo administrativo. Escape fecha os diálogos da prévia e devolve foco ao cartão. Só Agenda e Projetos possuem telas neste harness; demais links de navegação pertencem ao shell e não representam fluxos conectados.

## Shell de navegação

Abra /chrome.html no mesmo servidor para testar AuthShell, BottomNav e PageHeader reais. Router em memória, identidade administrativa fictícia e autenticação bloqueada. Os cartões de conteúdo são ilustrativos e não representam telas conectadas. Verifique 360, 640, 768 e 1440 px, foco por teclado e cabeçalhos durante a rolagem. Nenhum cliente ou chamada de CRM é usado.

## Financeiro e painel administrativo do tatuador

Abra /management.html. Usa FinanceView e ArtistPanelView reais, em router de memória e somente com dados fictícios. A data de referência financeira é 12/11/2026 em Bruxelas; a sessão de dezembro deve ficar fora de Hoje, Semana e Mês. O resumo mantém o conjunto retornado pela fonte; os filtros alteram somente a lista. A ação real de sincronização não é importada neste harness.

Checklist: 360/390/768/1440 px; filtros por período, status, tatuador e vendedor; limpar filtros; visões de comissão de tatuador/vendedor; estado vazio, carregando, erro com nova tentativa e fonte indisponível; checkbox de nomes indisponíveis mantém os IDs e a comissão. No painel: 30/60/90 dias, artista sem registros, null diferente de zero, projetos separados, próxima data e navegação por teclado. O clique de um compromisso informa o dia e ID demonstrativos; não abre registros reais. Voltar à agenda abre /operations.html.

A troca de visão financeira altera o modelo de apresentação; o AuthShell permanece com identidade administrativa fictícia. Não comprova autenticação, permissões de outros perfis, completude do GHL ou aplicação da comissão por data. Somente Financeiro e Painel possuem telas neste harness; demais links do shell não representam fluxos conectados.
