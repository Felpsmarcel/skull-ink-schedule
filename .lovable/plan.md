## Situação

A tela `src/routes/_authenticated/_admin/reconciliar.tsx` já atende a todos os critérios pedidos:

- Cards legíveis com `StatusBadge "Pendente"`, motivo em destaque, data formatada (`pt-PT`), event id em mono e bloco "Ação recomendada" com heurística por palavra-chave (`recommendedAction`).
- Payload técnico dentro de `<Collapsible>` "Ver detalhes técnicos", fechado por padrão.
- Botão "Resolvido" abre `AlertDialog` confirmando: *"Isto apenas marca esta falha como tratada. Não reprocessa o evento no banco nem altera nada no GHL."*
- `EmptyState` (Inbox), `ErrorState` com retry e `Skeleton` × 3 cobrem os três estados.
- Rota está sob `_authenticated/_admin/`, protegida pelo gate de admin existente.

`src/lib/sync.functions.ts` também não precisa de alteração — `resolveSyncFailure` mantém a semântica de só marcar `resolved_at`/`resolved_by`, sem reprocessar.

## Plano

Nenhuma alteração de código. A entrega solicitada já está em produção desde o ciclo anterior do Reconciliar.

Se quiser, posso ir além do escopo pedido com um destes ajustes opcionais — só me dizer qual (ou nenhum):

1. **Agrupar falhas por motivo** (ex.: "3× contato não encontrado") para reduzir ruído quando o mesmo erro repete.
2. **Filtro/contador no header** ("12 em aberto") + busca por event id.
3. **Link direto para o evento no GHL** quando `ghl_event_id` existir (abre em nova aba).
4. **Toast com ação "Desfazer"** após marcar como resolvido (dentro do mesmo `resolveSyncFailure`, sem mudar lógica do servidor — apenas re-update via outra chamada).

## Fora de escopo (mantido)

Migrations, schema, GHL, permissões e a lógica de `resolveSyncFailure`.