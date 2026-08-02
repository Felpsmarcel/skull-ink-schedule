## Situação atual

O relatório de pagamentos (`/relatorios/movimentacoes`) já tem:
- filtro por **intervalo de datas**, **tatuador**, **recebido por**, tipo, sync GHL e origem (link vs manual);
- exportação **CSV** e **HTML** (imprimível/PDF) com os totais e o detalhe.

O que falta para fechar o pedido é o filtro por **quem registou** (a pessoa que preencheu o formulário). Esse dado já é gravado em cada lançamento, mas ainda não é filtrável nem exportável como coluna filtrada.

## O que vou fazer

1. **Filtro "Registado por"** no relatório, com a mesma lista fechada de staff (Gabriel, Nívia, Augusto, André, Joyce) usada em "Recebido por". Fica guardado no endereço da página, como os outros filtros, para poderes partilhar/voltar ao mesmo recorte.
2. **Combinação de filtros**: datas + tatuador + recebido por + registado por funcionam em conjunto, e o botão "Limpar" também reseta o novo filtro.
3. **Exportações refletem os filtros**: o CSV e o HTML passam a indicar no cabeçalho o recorte aplicado (período, tatuador, recebido por, registado por), para a auditoria ficar auto-explicativa. As colunas "Recebido por" e "Registado por" já existem no detalhe.
4. **Nome do ficheiro** de exportação passa a incluir o período (já inclui) — mantém-se, sem mudanças.

## Notas técnicas

- Nova versão da função de base de dados `get_movimentacoes_report` com o parâmetro extra `p_registrador` (filtra por `registrado_por_staff_id`, com fallback por `registrado_por_nome` para registos antigos), mantendo a assinatura atual para não quebrar chamadas existentes.
- `src/lib/movimentacao.functions.ts`: acrescentar `registrador` ao `ReportInput` e passar `p_registrador` ao RPC.
- `src/routes/_authenticated/relatorios.movimentacoes.tsx`: novo campo no painel de filtros (`registrador` no `validateSearch` com `fallback`), incluir na `queryKey`, no estado "tem filtros ativos" e no "Limpar".
- `src/lib/report-html.ts`: `ReportMeta` ganha uma linha de "Filtros aplicados" no cabeçalho do HTML; CSV mantém as colunas atuais.
- Validar com `tsgo` e build de produção.
