## Objetivo
Nunca mais ficar sem saber **quem** criou ou alterou um lançamento financeiro. Hoje o formulário público grava apenas o "Recebido por" escolhido no ecrã, e `registrado_por_app_user_id` fica NULL em 100% dos registos vindos de link.

## 1. Identificar quem submete pelo link público

No formulário `/movimentacao/<link>` (etapa final, antes de confirmar):
- Novo campo **obrigatório** "Quem está a registar?" — mesma lista fechada de staff (Gabriel, Nívia, Augusto) já usada em "Recebido por", com opção "Outro" + nome livre.
- Pré-selecionado com o recebedor escolhido (o caso mais comum), mas alterável, e memorizado no dispositivo para os próximos lançamentos.
- Guardado em novas colunas de `movimentacoes`: `registrado_por_nome` e `registrado_por_staff_id`.

Além disso, gravado automaticamente no servidor (sem pedir nada ao utilizador):
- `registrado_user_agent` (dispositivo/navegador), `registrado_ip_hash` (IP com hash, para distinguir dispositivos sem guardar o IP em claro) e `registrado_em`.

Para lançamentos feitos dentro da app autenticada (manual do admin), `registrado_por_app_user_id` continua a ser preenchido com o utilizador real — nada muda.

## 2. Histórico de alterações

Nova tabela `movimentacoes_audit` com: lançamento, ação (`criado` / `editado` / `apagado` / `resync`), quem (app_user ou nome do staff do link), quando, e o antes/depois dos campos alterados em JSON.

Registada automaticamente por trigger na tabela `movimentacoes`, de modo que qualquer alteração — pela app, pelo link, ou por correção direta em base de dados — fica no histórico.

## 3. Onde isto aparece

- **Relatório de pagamentos** (`/relatorios/movimentacoes`): nova coluna/filtro **"Registado por"**, incluída também nos exports CSV e HTML.
- **Ecrã de edição do lançamento**: bloco "Histórico" no fundo, listando cada alteração (quem, quando, o que mudou).
- **Histórico público** (`/movimentacao/historico`): mostra "Registado por" apenas como nome, sem dados de dispositivo/IP.

## 4. Registos antigos
Os lançamentos já existentes ficam com "Registado por: — (não registado)". Não vou inventar autoria retroativa; a partir da mudança, todos passam a ter origem identificada.

## Notas técnicas
- Migração: colunas novas em `movimentacoes`, tabela `movimentacoes_audit` com GRANTs e RLS (leitura só para autenticados; escrita só pelo trigger/service role), trigger de auditoria.
- `get_movimentacoes_report` e as RPC públicas passam a devolver `registrado_por_nome`; as RPC públicas não expõem user agent nem hash de IP.
- Ficheiros tocados: `src/lib/movimentacao.functions.ts`, `src/components/movimentacao/movimentacao-form.tsx`, `src/routes/_authenticated/relatorios.movimentacoes.tsx`, `src/lib/report-html.ts`, rota de edição e `src/routes/movimentacao.historico.tsx`.
