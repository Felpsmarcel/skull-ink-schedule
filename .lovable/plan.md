# Registrar pagamento: Descrição do projeto + Data da tatuagem

## O que muda

1. **Novo campo "Descrição do projeto"** no formulário de registo de pagamento (etapa 3, junto às Observações): texto livre curto para descrever o projeto/tatuagem (ex.: "cover-up braço direito").
2. **Campo de data renomeado**: o atual "Data da sessão" passa a chamar-se **"Data da tatuagem"** (mesmo campo, mesmo dado — continua obrigatório quando o tipo é *Sinal*).
3. A descrição aparece no **resumo antes de gravar**, no **ecrã de confirmação**, na **página de edição** do lançamento e no **relatório de pagamentos** (detalhe + exportações CSV e HTML).

## Onde aparece

- `/movimentacao/{link}` (formulário público) e `/admin/movimentacao/novo` (lançamento manual) — ambos usam o mesmo formulário.
- `/movimentacao/historico/{id}/editar` — descrição editável, com registo no histórico de alterações.
- `/relatorios/movimentacoes` — nova coluna "Projeto" no detalhe e nas exportações.

## Detalhes técnicos

- **Migração**: `ALTER TABLE public.movimentacoes ADD COLUMN descricao_projeto text` (nullable, sem default). Atualizar as funções `get_movimentacoes_report` (todas as sobrecargas em uso) e `list_movimentacoes_historico` para devolver `descricao_projeto`.
- **Server** (`src/lib/movimentacao.functions.ts`): adicionar `descricao_projeto: z.string().max(500).nullable().optional()` aos validadores de `createMovimentacao`, `createMovimentacaoManual` e `updateMovimentacao`; incluir no insert/update, em `getMovimentacaoForEdit` e no tipo `ReportRow`.
- **GHL** (`src/lib/movimentacao-ghl.server.ts`): incluir a descrição no payload enviado ao CRM, junto a `observacoes`/`data_tatuagem`.
- **Formulário** (`src/components/movimentacao/movimentacao-form.tsx`): novo campo em `FormState` + `initialState`, `Input` (h-14, mobile-first) acima das Observações, label do date field para "Data da tatuagem" (mensagem de erro do sinal ajustada), linha no card de Resumo e na `Confirmation`.
- **Relatório** (`src/lib/report-html.ts` + `src/routes/_authenticated/relatorios.movimentacoes.tsx`): coluna "Projeto" no HTML/CSV e no detalhe da lista.
- Auditoria: o trigger `movimentacoes_audit_trg` já captura colunas alteradas; confirmar que o novo campo aparece no diff da página de edição.
- Sem alteração de RLS/GRANTs (coluna nova em tabela existente).
