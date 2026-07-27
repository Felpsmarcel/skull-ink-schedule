# Plano: UX mobile do registro de pagamento

## Contexto
A página pública `/movimentacao/[slug]` é usada por tatuadores e vendedores no celular para registar pagamentos. O formulário atual exibe todos os campos de uma só vez e exige muitos toques/edições manuais, o que atrasa o registro no dia a dia do estúdio.

## Objetivo
Reduzir o tempo e o número de toques para registar um pagamento no mobile, sem perder precisão ou validação.

## Escopo
Foco apenas na página `/movimentacao/[slug]` e no componente `MovimentacaoForm`. Não alterar regras financeiras, tabelas ou sync GHL.

## Implementação

### 1. Wizard de 3 passos
Dividir o formulário longo em etapas para reduzir carga cognitiva:

- **Passo 1 — Cliente e Tatuador**
  - Nome do cliente (input com autocomplete de clientes recentes)
  - Seletor de tatuador (já pré-selecionado pelo slug)
  - Botão "Próximo"

- **Passo 2 — Valor e Método**
  - Tipo de movimento (chips: Sinal, Sessão, Saldo, Produto, Estorno)
  - Método de pagamento como chips exclusivos + combinação permitida (Cartão, Dinheiro, SumUp, Transferência)
  - Input de valor com botões rápidos: €50, €100, €150, €200, €250
  - Total destacado e sticky no rodapé deste passo

- **Passo 3 — Detalhes e Confirmar**
  - Data do pagamento (default hoje)
  - Data da sessão agendada (obrigatória apenas para "Sinal")
  - Observações (opcional)
  - Resumo final e botão "Registar pagamento"

### 2. Otimizações mobile
- Aumentar altura dos inputs e botões para `h-13`/`h-14` (mínimo 52–56 px).
- Usar `inputMode="decimal"` e teclado numérico para valores.
- Adicionar safe-area no rodapé dos passos.
- Manter indicador de progresso (1-2-3) no topo.
- Permitir navegação "Voltar" entre passos sem perder dados.

### 3. Ajudas e defaults inteligentes
- Sugerir clientes recentes (últimos 20 registados no mesmo slug) ao digitar o nome.
- Pré-selecionar tatuador e "Recebido por" conforme o slug.
- Data do pagamento default = hoje.
- Destacar visualmente quando o total for > 0 e quando houver erro de método exclusivo (Cartão + SumUp).

### 4. Confirmação pós-submit
- Manter a tela de confirmação, mas adicionar:
  - Botão grande "Novo registo".
  - Botão "Ver no histórico".
  - Badge de status do sync GHL.
  - Opção de copiar resumo do pagamento (cliente + valor) para área de transferência.

## Arquivos envolvidos
- `src/components/movimentacao/movimentacao-form.tsx` (refatoração principal)
- `src/routes/movimentacao.$slug.tsx` (ajustes de layout/safe-area)
- `src/lib/movimentacao.functions.ts` (novo server fn para listar clientes recentes)
- `src/styles.css` (pequenos ajustes de utilitários, se necessário)

## Critérios de aceitação
- Formulário funciona em 3 passos no mobile.
- Registro de pagamento comum (Sessão + Cartão/Dinheiro) é feito em ≤ 5 toques após digitar o nome.
- Build limpo (`tsgo` e `bun run build` passam).
- Nenhuma regressão na validação ou no sync GHL.

## Notas
- Não alterar schema do banco.
- Não alterar regras de RLS ou sync.
- Manter a página pública (sem autenticação obrigatória).