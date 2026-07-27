# Melhorias no Relatório de Pagamentos (lançamentos)

## Estado atual

A página `/relatorios/movimentacoes` já entrega:

- Filtros por período (atalhos mês atual/anterior + intervalo livre), tatuador (admin) e tipo de movimento, todos sincronizados na URL.
- Cards de topo: total recebido, número de pagamentos, ticket médio, valor com sync pendente.
- Quebras por forma de pagamento, tatuador e tipo de movimento, com barras proporcionais.
- Lista de detalhe com data, cliente, tatuador, tipo, formas, total e status GHL.
- Exportação para Imprimir/PDF, HTML autónomo e CSV.
- Acesso controlado por papel (admin vê tudo; recebedor vê só os seus).

## O que mudaria e porquê

### 1. Adicionar filtro "Recebido por"

**Porquê:** Hoje o admin filtra por tatuador, mas o dinheiro entrou na mão de um vendedor/tatuador recebedor. Para conciliar caixa, o filtro natural é "quem recebeu".

**Como:**
- Adicionar `p_recebedor uuid` à RPC `get_movimentacoes_report`.
- A lista de opções vem de `STAFF_RECEBEDORES` ou de uma consulta a `app_users` com perfis de recebedores.
- Mostrar o filtro apenas para admin (recebedores comuns já só veem os próprios lançamentos).

### 2. Filtro por status de sync GHL

**Porquê:** Permite ao administrador focar rapidamente nos lançamentos que falharam e precisam de reprocessamento.

**Como:**
- Adicionar `p_sync_status` à RPC com opções `pending`, `synced`, `failed`.
- URL: `?sync=failed`.

### 3. Comparação com período anterior

**Porquê:** O total de hoje só faz sentido quando comparado com ontem/mês passado.

**Como:**
- Calcular o período imediatamente anterior ao selecionado (mesma duração).
- Buscar os agregados desse período via uma segunda chamada à RPC ou calcular no cliente se o volume for pequeno.
- Mostrar seta + percentagem nos cards de topo: total recebido, número de pagamentos e ticket médio.

### 4. Gráficos simples

**Porquê:** Tornar padrões óbvios em segundos (picos de dia, domínio de cartão vs. dinheiro, etc.).

**Como:**
- Gráfico de barras: evolução diária do total recebido no período.
- Gráfico de donut/pizza: distribuição por forma de pagamento.
- Biblioteca: `recharts` (leve, React-friendly).
- Esconder gráficos na versão de impressão (`no-print`).

### 5. Paginação e busca no detalhe

**Porquê:** À medida que o histórico cresce, renderizar todos os lançamentos de uma vez fica pesado e difícil de ler.

**Como:**
- Paginar o detalhe em blocos de 25 ou 50.
- Campo de busca por nome do cliente com debounce.
- Manter a busca na URL (`?q=maria`).

### 6. Agrupar detalhe por dia

**Porquê:** No mobile, uma lista longa de lançamentos perde o contexto temporal. Agrupar por dia facilita conciliação de caixa.

**Como:**
- Separador de data com subtotal do dia.
- Expandir/colapsar dias no mobile.

### 7. Exportação para Excel (.xlsx)

**Porquê:** CSV abre quebrado em Excel português (separador `;` ajuda, mas .xlsx é imediato e profissional).

**Como:**
- Gerar `.xlsx` com duas abas: "Resumo" (cards + quebras) e "Detalhe" (todos os campos).
- Biblioteca: `xlsx` (sheetjs) ou `exceljs` — verificar compatibilidade com Worker/edge no build.

### 8. Cards de alerta

**Porquê:** Destacar situações que precisam de ação.

**Como:**
- Card "Sync com falha" em tom de alerta quando `failed > 0`.
- Card "Estornos no período" quando houver estornos, mostrando valor líquido (total - estornos).

### 9. Navegação para edição a partir do detalhe

**Porquê:** Quando o admin encontra um lançamento errado no relatório, quer corrigi-lo sem sair do contexto.

**Como:**
- Tornar cada linha do detalhe clicável, navegando para `/movimentacao/historico/<id>/editar`.
- Voltar para o relatório com os mesmos filtros na URL.

### 10. Relatórios salvos/favoritos

**Porquê:** Usuários repetem os mesmos filtros toda semana (ex.: "Mensalidade Gabriel").

**Como:**
- Guardar combinações de filtros com nome no `localStorage`.
- Botão "Guardar filtro" + dropdown de filtros salvos.
- Futuro: persistir na base se for adotado.

## Ordem de implementação sugerida

Fase 1 — Ganho imediato, baixo risco:
1. Filtro "Recebido por".
2. Filtro por status de sync GHL.
3. Cards de alerta (falhas e estornos).
4. Navegação para edição no detalhe.

Fase 2 — Análise e visualização:
5. Comparação com período anterior.
6. Gráficos de evolução diária e formas de pagamento.
7. Agrupamento do detalhe por dia.

Fase 3 — Escala e conveniência:
8. Paginação e busca.
9. Exportação Excel.
10. Relatórios salvos.

## Critérios de aceitação

- `tsgo` sem erros.
- Filtros novos sincronizados na URL.
- Impressão/PDF continua limpa (gráficos e botões escondidos).
- Mobile continua usável (filtros não empurram conteúdo para fora da viewport).

## Próximo passo

Recomendo começar pela **Fase 1**: filtro "Recebido por", status de sync, alertas e link para edição. São mudaras pequenas que já resolvem dores reais de conciliação e reprocessamento.
