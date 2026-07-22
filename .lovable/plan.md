# /movimentacao/historico — histórico público de pagamentos

Rota pública (sem auth) que lista todos os registos de `movimentacoes`, com paginação, destaque via `?highlight=<id>` e link "Voltar".

## Mapeamento do spec ↔ schema real

O schema real difere do descrito no pedido. Reconciliação:

| Pedido            | Schema real                                                                     |
| ----------------- | ------------------------------------------------------------------------------- |
| `cliente`         | `nome_cliente`                                                                  |
| `tatuador`        | join `artists.name` via `artist_id`                                             |
| `link`            | `link_origem`                                                                   |
| `tipo`            | `tipo_movimento` enum (`sinal`/`sessao`/`saldo`/`produto`/`estorno`) → rotular  |
| `metodo`          | derivado dos `valor_cartao/dinheiro/sumup/transferencia > 0` (pode ser "misto") |
| `valor`           | `total`                                                                         |
| `ghl_status`      | `ghl_sync_status` enum (`pending`/`synced`/`failed`)                            |
| `created_at`      | `created_at`                                                                    |

Rótulos:
- Tipo: sinal→"Sinal", sessao→"Sessão pagamento do dia", saldo→"Valor total", produto→"Produto GF TATTOO", estorno→"Estorno"
- Método: se só um valor > 0 → nome desse método (Cartão/Dinheiro/SumUp/Transferência); se >1 → "Misto"
- Badge: `synced`→"✓ Sync" (verde); `pending`/`failed`→"⚠ Pendente" (âmbar). Nunca expor "failed"/erros técnicos.

## Passos

1. **Server function pública** `listMovimentacoesHistorico` em `src/lib/movimentacao.functions.ts`:
   - Sem `.middleware([requireSupabaseAuth])`. Usa cliente publishable (`SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`, sem persistência) dentro do `.handler`.
   - Input: `{ page: number, pageSize: 15 }`.
   - Query: `movimentacoes` LEFT JOIN `artists(name)`, ORDER BY `created_at DESC`, `range((page-1)*15, page*15-1)`, `count: exact`.
   - Retorna DTO plano: `{ rows: HistoricoRow[], total: number, totalValor: number }`.
     - `totalValor` via segunda query `select('total').eq(...)` agregando no servidor (ou RPC simples). Para simplicidade: `select('total')` sem paginação e somar — pequenos volumes. Se preferível, criar RPC `movimentacoes_stats()` retornando `{ count, sum }`.
   - Projeção apenas dos campos necessários (sem PII sensível além do que já aparece no formulário público).

2. **RLS**: adicionar policy `SELECT` para `anon` em `movimentacoes` restrita às colunas seguras — via GRANT + policy `USING (true)`. (Já existe grant? Verificar antes; se não, incluir migração.)
   - Como alternativa mais segura sem expor a tabela: manter query via server function usando publishable key + policy `TO anon` com `USING (true)` (o server publishable client atua como anon). Não expor a tabela ao browser diretamente.

3. **Locate/procurar página do highlight** — `findMovimentacaoPage` server fn:
   - Input `{ id: string, pageSize: 15 }`. Faz `count` de rows com `created_at > (select created_at from movimentacoes where id = $id)` para calcular a página. Retorna `{ page }` ou `null`.

4. **Rota** `src/routes/movimentacao.historico.tsx` (pública, sem gate):
   - `validateSearch`: `{ page: fallback(z.number().int(), 1).default(1), highlight: fallback(z.string(), "").default("") }`.
   - `head()`: title "Histórico de pagamentos — GF Tattoo", `robots: noindex,nofollow`.
   - `loader`: `ensureQueryData` para `listMovimentacoesHistorico({ page })`.
   - Componente usa `useSuspenseQuery`.

5. **UI** mobile-first, tokens do design system existente (não hardcode cores exceto quando o spec pede explicitamente #E11D2A/#16a34a):
   - Header sticky com botão "← Voltar" (`useRouter().history.back()` com fallback `navigate({ to: "/movimentacao/$slug", params: { slug: "gabriel" }})`).
   - Título + subtítulo "N registos · Total: € X,XX" (formatação `Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })`).
   - Grid `flex flex-col gap-3` de cards `rounded-xl shadow-sm border bg-card p-4`.
   - Cada card com layout descrito (data, cliente bold, tatuador, tipo·método, valor à direita verde, badge no topo-direita).
   - Paginação: "← Anterior" / "Página X de Y" / "Próximo →" com `<Link>` (search fn form) para preservar `highlight`. Scroll para topo via `useEffect` em mudança de `page`.
   - Skeletons (3), erro com botão retry (`router.invalidate()`), estado vazio.

6. **Highlight**:
   - `useEffect([data, highlight])`: se `highlight` presente, procurar card pelo id na página atual.
     - Se encontrado: `scrollIntoView({ behavior: 'smooth', block: 'center' })`, aplicar classe `ring-2 ring-[#E11D2A]` com `transition`. Timer 3s remove a classe.
     - Se não encontrado nesta página: chamar `findMovimentacaoPage({ id: highlight })`. Se retornar `page` diferente, mostrar `toast` com botão "Ir para essa página" → `navigate({ search: { page: X, highlight } })`.

7. **Ligação a partir do form**: o `ConfirmationScreen` já tem link "Ver no histórico" — atualizar para apontar para `/movimentacao/historico?highlight=<id>` (já pode existir; verificar em build mode).

## Segurança / considerações

- Página pública lista nomes de clientes e valores. Confirmar com o utilizador que isto é aceitável (já era assumido pelo pedido — "acesso público").
- Adicionar `robots: noindex,nofollow` para evitar indexação.
- Não expor `ghl_sync_error` nem `chave_idempotencia` no DTO.
- Rate/quantidade: sem filtros; se a tabela crescer muito, considerar filtro por período no futuro (fora do escopo agora).

## Arquivos a criar/editar

- `src/lib/movimentacao.functions.ts` — adicionar `listMovimentacoesHistorico` + `findMovimentacaoPage` (server fns públicas).
- `src/routes/movimentacao.historico.tsx` — nova rota pública.
- Migração SQL — grant SELECT + policy anon em `movimentacoes` (colunas necessárias), se ainda não existir.
- `src/components/movimentacao/movimentacao-form.tsx` — garantir que o link "Ver no histórico" da confirmação usa `?highlight=<id>`.
