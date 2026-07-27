# Correção: Dashboard e relatório HTML para lançamentos manuais

## O que foi feito até agora
- Foi criada a página `/relatorios/movimentacoes` com cards, filtros e exportação HTML/CSV.
- Porém, ela lista **todos** os registros da tabela `movimentacoes`, sem distinguir origem.
- A coluna `origem_lancamento` existe, mas hoje só é preenchida com `link_individual`.
- Não existe tela nem função para criar um registro com `origem_lancamento = 'manual'`.

## O que será construído

### 1. Criar a origem "manual" no banco
- Garantir que `movimentacoes.origem_lancamento` aceite o valor `manual`.
- Criar/alterar a função `get_movimentacoes_report` para aceitar o parâmetro `p_origem` e filtrar por `origem_lancamento`.
- Atualizar `list_movimentacoes_historico` para também expor/originar corretamente (sem quebrar o histórico público).

### 2. Criar função de criação de lançamento manual
- Novo server function `createMovimentacaoManual` em `src/lib/movimentacao.functions.ts`.
- Recebe os mesmos campos do link público, mas grava:
  - `origem_lancamento = 'manual'`
  - `registrado_por_app_user_id = auth.uid()` (quem digitou)
  - `recebido_por_app_user_id` pode ser escolhido (ex: Gabriel, Nívia, Augusto) ou default do operador logado.
- Validações iguais às do link (métodos exclusivos, total > 0, etc.).
- Dispara o sync GHL como best-effort, igual ao link.

### 3. Nova página de lançamento manual
- Rota: `/admin/movimentacao/novo` (acesso autenticado, idealmente admin/staff).
- Formulário mobile-first com os mesmos campos do wizard de pagamento:
  - Cliente, data do pagamento, tatuador, tipo (sinal/sessão/saldo/produto/estorno).
  - Valores por forma de pagamento (cartão, dinheiro, SumUp, transferência).
  - Quem recebeu o pagamento (select de recebedores).
  - Data da tatuagem (quando aplicável) e observações.
- Após salvar, redireciona para o relatório filtrado em "Manuais".

### 4. Dashboard de lançamentos manuais
- Opção A (recomendada): adicionar um filtro de origem na página `/relatorios/movimentacoes`:
  - "Todos" / "Link individual" / "Lançamento manual".
  - A URL reflete a origem escolhida (`?origem=manual`).
  - Cards e gráficos recalculam automaticamente.
- Opção B (alternativa): criar rota dedicada `/relatorios/movimentacoes/manual` que já abre filtrada.
- Escolha da abordagem depende da sua preferência (ver pergunta abaixo).

### 5. Relatório HTML para manuais
- A exportação HTML/CSV já existente em `src/lib/report-html.ts` será atualizada para:
  - Receber o filtro de origem.
  - Gerar o relatório com título e metadados indicando "Lançamentos manuais" quando aplicável.
  - Manter os mesmos cards, tabelas e totais, mas apenas dos registros manuais.

### 6. Menu e navegação
- Adicionar atalho no menu admin para "Novo lançamento manual".
- Adicionar atalho no relatório para alternar entre "Link individual" e "Manuais".

## Decisões pendentes
1. **Você prefere**:
   - (A) Apenas um filtro na página atual `/relatorios/movimentacoes` para ver manuais; ou
   - (B) Uma rota separada `/relatorios/movimentacoes/manual` como dashboard próprio?
2. **Quem pode criar lançamentos manuais?** Apenas admin, ou também vendedores/tatuadores autenticados?

## Critérios de aceitação
- É possível criar um pagamento com origem `manual` pela interface.
- O relatório consegue filtrar e mostrar apenas lançamentos manuais.
- A exportação HTML/CSV reflete o filtro ativo.
- Build (`tsgo` + `bun run build`) passa sem erros.
- Nenhum registro antigo (`link_individual`) é perdido ou alterado.
