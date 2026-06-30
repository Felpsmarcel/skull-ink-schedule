## Objetivo
Melhorar feedback do botão "Sincronizar GHL" no Financeiro e no Reconciliar, usando o `SyncResult` que o servidor já devolve (`scannedCalendars`, `fetchedEvents`, `inserted`, `updated`, `failures`, `errors`).

## Fora de escopo
`src/lib/sync.functions.ts` e `sync.server.ts` — o payload já contém tudo. Nenhuma mudança em migrations, schema, cron, GHL ou permissões.

## 1. Componente compartilhado — `src/components/sync-ghl-button.tsx` (novo)
Encapsula UX consistente nos dois lugares; evita divergir copy/toast.

- Props: `variant?`, `size?`, `className?`, `onSettled?()`.
- Internamente: `useServerFn(runGhlSync)` + `useMutation`.
- `disabled = syncM.isPending` — atende anti-duplo-clique mesmo com cliques rápidos (TanStack Query também deduplica a mutation em voo).
- Render:
  - Idle: `<RefreshCw />` + "Sincronizar".
  - Pending: `<RefreshCw className="animate-spin" />` + "Sincronizando…", `aria-busy`.
- `onSuccess(r)`:
  - Toast `toast.success("Sincronização concluída", { description })` onde `description` é uma linha resumo:
    `${scannedCalendars} calendários · ${fetchedEvents} eventos · ${inserted} novos · ${updated} atualizados · ${failures} falhas`.
  - Se `failures > 0`, usar `toast.warning` (sonner aceita) com a mesma descrição + ação "Reconciliar" navegando para `/reconciliar` (via callback opcional `onHasFailures`, default sem ação extra).
  - Invalida `["finance-summary"]`, `["sync-failures"]`, `["agenda-status"]`, `["agenda"]`.
  - Chama `onSettled?.()` para a página decidir extras.
- `onError(e)`:
  - `toast.error("Falha ao sincronizar", { description: friendlyMessage(e) })`.
  - `friendlyMessage`: mapeia mensagens conhecidas ("Unauthorized" → "Sessão expirada. Faça login novamente."; "GHL_TOKEN ausente" → "Token do GHL não configurado."; "Apenas administradores…" → mesma string). Fallback: "Não foi possível sincronizar agora. Tente novamente em instantes."
  - Detalhe técnico: incluir `e.message` cru em `description` apenas como segunda linha (`\n`), e copiar mensagem completa via botão `action: { label: "Copiar erro", onClick: () => navigator.clipboard.writeText(e.message) }`. Sem expor stack nem secrets.

## 2. `src/routes/_authenticated/financeiro.tsx`
- Remover `useMutation`/`useServerFn(runGhlSync)`/`syncM` locais e o `<Button>` inline.
- Substituir por `<SyncGhlButton size="sm" variant="outline" />` dentro do mesmo bloco `{isAdmin ? … : null}` (mantém restrição admin).
- Remover imports não usados (`useMutation`, `useServerFn`, `runGhlSync`, `toast` se não restar uso, `RefreshCw` se não restar uso).
- `useQueryClient`/`qc` permanece se outra parte usa; senão remover.

## 3. `src/routes/_authenticated/_admin/reconciliar.tsx`
- Substituir o `<Button>` "Sincronizar agora" + `syncM` por `<SyncGhlButton size="sm" variant="outline">Sincronizar agora</SyncGhlButton>` (componente aceita `children` opcional para sobrescrever rótulo idle; pending continua "Sincronizando…").
- Remover `useMutation`/`useServerFn(runGhlSync)` e imports órfãos.
- `resolveM` e demais lógicas ficam intactas.

## 4. Acessibilidade & anti-duplo-clique
- `disabled` durante `isPending` + `aria-busy="true"` + `aria-live` implícito do sonner cobrem leitores de tela.
- Como cada página tem sua própria instância do `useMutation`, dois botões em telas diferentes podem rodar — aceitável (são páginas distintas, raro). No mesmo render, `disabled` previne duplo disparo.

## Critérios de aceite — mapeamento
1. Botão troca rótulo/ícone enquanto roda → 1 ✓.
2. Toast sucesso com resumo numérico → 2 ✓.
3. Toast erro com mensagem amigável + "Copiar erro" → 3 ✓.
4. `disabled` + dedup do `useMutation` → 4 ✓.
5. `invalidateQueries` cobre finance-summary, sync-failures, agenda-status, agenda → 5 ✓.
6. Componente renderizado só dentro do bloco `isAdmin` em ambas as telas → restrição mantida.