# Dashboard de Relatórios — Histórico de Pagamentos

Nova página autenticada `/relatorios/movimentacoes` que resume os pagamentos registados (tabela `movimentacoes`), com agregações e um relatório HTML imprimível/exportável.

## Acesso

- **Admin**: vê todos os registos.
- **Recebedor** (tatuador/vendedor que consta como "recebido por"): vê apenas os pagamentos que recebeu.
- Registos apagados (soft delete) ficam de fora.

A regra de acesso é aplicada no banco, não no frontend.

## Filtros

- Atalhos rápidos: mês atual, mês anterior, seletor mês/ano.
- Intervalo livre: data inicial e data final.
- Filtro opcional por tatuador (apenas admin) e por tipo de movimento.
- Filtros refletidos na URL, para o relatório poder ser partilhado/recarregado.

## Conteúdo do dashboard

1. **Cartões de topo**: total recebido no período, número de pagamentos, ticket médio, valor com sincronização pendente.
2. **Totais por forma de pagamento**: cartão, dinheiro, SumUp, transferência — valor, % do total e barra proporcional.
3. **Totais por tatuador**: tabela ordenada por valor, com nº de pagamentos.
4. **Totais por tipo de movimento**: sinal, sessão, saldo, produto, estorno.
5. **Detalhe**: lista completa dos pagamentos do período (data, cliente, tatuador, tipo, formas, total, status de sync).

## Relatório HTML

- Botão **Imprimir / Guardar PDF**: estilos de impressão (`@media print`) que escondem navegação, botões e filtros e formatam o relatório em A4 com cabeçalho (logo GF, período, quem gerou, data de emissão).
- Botão **Exportar HTML**: gera um ficheiro `.html` autónomo (estilos inline, sem dependências) com os mesmos blocos, descarregado no dispositivo — abre em qualquer browser e pode ser enviado por email/WhatsApp.
- Mantém-se também a exportação CSV já usada noutros relatórios, para Excel.

## Detalhes técnicos

- **Banco**: nova função `SECURITY DEFINER` `get_movimentacoes_report(p_start timestamptz, p_end timestamptz, p_artist uuid, p_tipo text)` que:
  - resolve o papel via `current_user_role()`; se não for `admin`, filtra por `recebido_por_app_user_id = auth.uid()`; sem sessão, levanta `unauthorized`;
  - devolve as linhas do período (colunas seguras) já com nome do tatuador;
  - `GRANT EXECUTE ... TO authenticated` (sem `anon`).
  - As agregações por forma/tatuador/tipo são calculadas no cliente a partir dessas linhas (volume por mês é pequeno), evitando múltiplas idas ao banco.
- **Server functions**: `getMovimentacoesReport` em `src/lib/movimentacao.functions.ts`, com `requireSupabaseAuth`, chamando a RPC acima.
- **Rota**: `src/routes/_authenticated/relatorios.movimentacoes.tsx` (fora do gate `_admin`, pois recebedores também acedem), com `head()` próprio e `robots: noindex`.
- **Componentes**: `src/components/relatorios/` — `report-summary-cards.tsx`, `breakdown-table.tsx`, `report-print-header.tsx`; gerador do HTML autónomo em `src/lib/report-html.ts` (função pura, testável, reutilizada pela exportação).
- **Estilos de impressão**: bloco `@media print` em `src/styles.css`, sem cores hardcoded fora dos tokens.
- **Navegação**: nova linha "Relatório de pagamentos" no menu (`src/routes/_authenticated/menu.tsx`), visível para admin e recebedores.
- Formatação monetária e de datas reutiliza `src/lib/format.ts` (EUR, `pt-PT`, fuso Europe/Brussels).

## Verificação

- `tsgo` sem erros.
- Conferência no preview mobile: dashboard com dados reais, exportação HTML aberta e inspecionada, e pré-visualização de impressão sem cortes.

Self critique antes de criar 