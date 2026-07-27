## Objetivo
Reatribuir para **Augusto Santos** os lançamentos financeiros que hoje constam com **Gabriel Fernandes** como tatuador.

## Registos afetados

| Cliente | Data pag. | Valor | Link | Recebido por |
|---|---|---|---|---|
| Ernest cover Jordan | 25/07 | €750 (transferência) | gabriel | Augusto |
| Ernest cover Jordan | 25/07 | €600 (dinheiro) | gabriel | Augusto |
| Vicenzo (sinal) | 25/07 | €100 (dinheiro) | nivia | Nívia |

## Ponto de atenção — Vicenzo
Já existe um lançamento **idêntico** (Vicenzo, 25/07, €100 dinheiro, link nivia) com **Augusto Santos** como tatuador. Se trocarmos o do Gabriel, ficam dois lançamentos iguais de €100 para o Augusto. Duas leituras possíveis:

- Foram mesmo **dois sinais** de €100 → trocar normalmente.
- Foi **duplicação** de registo → trocar e depois apagar (soft-delete) um deles.

Por defeito vou apenas **trocar o tatuador nos 3** e deixar o Vicenzo duplicado intacto; se me confirmares que é duplicação, apago o extra num passo seguinte.

## O que será feito
1. Atualizar `artist_id` dos 3 lançamentos para Augusto Santos, marcando `updated_at`.
2. Marcar esses registos como `pending` no sync do GHL, para que a próxima sincronização envie o tatuador correto (hoje eles estão dessincronizados).
3. Conferir no **Relatório de pagamentos** que os totais por tatuador refletem a mudança: Gabriel passa a €0 no período e Augusto absorve os €1.450.

## Nota técnica
Alteração apenas de dados na tabela `movimentacoes` (nenhuma mudança de esquema ou de código). Os registos ficam com histórico de `updated_at` atualizado.
