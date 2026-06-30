## Estado atual (auditado)

O formulário JÁ está conectado ao Supabase. Confirmei:

- `src/lib/services.functions.ts` faz `INSERT`/`UPDATE` reais na tabela `services` via `createServerFn` + `requireSupabaseAuth`, com `ensureAdmin()` antes de cada gravação.
- Policies OK: `services_public_read` (todos leem ativos) e `services_write_admin` (admin escreve, baseado em `current_user_role()`).
- Form em `services.tsx` chama `createService` / `updateService` no submit e `toggleServiceActive` no botão de power.
- Há invalidação por prefixo `["services"]` que atinge tanto a lista da tela (`["services","all"]`) quanto o catálogo do fluxo de agendamento (`["services"]`).

Ou seja: salvar e desativar **já gravam no banco**. O que falta é deixar a UI 100% sólida — sem flicker, sem chance de a sheet fechar antes do refetch, e com loading consistente.

## Gaps a corrigir

1. **Create/Update sem `useMutation`**: o submit usa `await` cru com `setBusy`. Funciona, mas não compartilha estado de loading/erro com a query e a sheet fecha antes do refetch retornar. Trocar por `useMutation` igual ao toggle, com `await qc.invalidateQueries(...)` dentro do `onSuccess` antes de chamar `onDone`.
2. **`onDone` invalida sem aguardar**: fazer `await qc.invalidateQueries({ queryKey: ["services"] })` para garantir que o card aparece atualizado quando a sheet some.
3. **`sort_order` no create**: hoje é opcional e fica `null`, jogando o serviço pro fim da categoria com ordenação imprevisível. No create, default = `max(sort_order)+1` dentro da categoria (calculado no server fn).
4. **Validação de range de preço**: bloquear `price_max_eur < price_eur` no Zod (`refine`) — hoje o banco aceita e a UI mostra range invertido.
5. **Estado vazio do toggle**: enquanto `toggleMut.isPending`, mostrar o `Loader2` no lugar do ícone Power do item específico (passar `variables.id` pro render), em vez de só `disabled`.

## Verificação (Playwright headless)

Após os fixes, rodar um script que:
- Loga como admin (sessão injetada), abre `/services`.
- Cria "Teste QA" em categoria "QA", confirma aparecer na lista sem refresh manual.
- Edita preço, confirma valor atualizado no card.
- Desativa, confirma badge "Inativo" + opacidade.
- Deleta a linha via `supabase--insert` (DELETE) para não poluir.
- Screenshot em cada passo.

## Detalhes técnicos

Arquivos tocados:
- `src/lib/services.functions.ts`: refine no Zod; no `createService`, antes do insert, `SELECT max(sort_order) WHERE category = ?` e setar `sort_order = max+1` se não vier no payload.
- `src/routes/_authenticated/services.tsx`:
  - `ServiceForm`: substituir `submit` por `useMutation` (create e update separados); `onSuccess` faz `await qc.invalidateQueries({ queryKey: ["services"] })` e então `onDone()`.
  - `toggleMut`: trocar `disabled` por render condicional do ícone usando `toggleMut.variables?.id === s.id && toggleMut.isPending`.
  - Manter `staleTime: 60_000` na lista (invalidate ignora staleTime).

Nada de mudança de schema. Nada de mudança em rotas.