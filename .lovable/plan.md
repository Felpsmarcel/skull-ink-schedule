# Relatório Mensal de Agendamentos

Reaproveitar o schema existente, adicionar apenas os campos novos de estilo/tamanho, expor um RPC seguro e construir a tela `/relatorios/agendamentos` para Admin (com visão restrita p/ Tatuador).

## 1. Migration (mínima, não destrutiva)

Adicionar em `public.appointments`:
- `tattoo_style text` (nullable) — estilo da tatuagem
- `tattoo_size text` (nullable) — tamanho (ex: P/M/G ou cm)

Nenhuma coluna existente é renomeada. `status`, `artist_id`, `calendar_id`, `total_eur`, `commission_pct`, `ghl_contact_id` continuam como estão. O fluxo de checkout passa a gravar `tattoo_style` / `tattoo_size` quando informados (campos opcionais no draft).

## 2. RPC `public.get_monthly_report`

`SECURITY DEFINER`, `search_path = public`, retorna `TABLE(...)` com colunas mapeadas para os nomes pedidos:

```text
id, nome_do_cliente (contact_name),
artista (artists.name), artist_id,
data_e_hora (start_at), estilo_de_tatuagem (tattoo_style),
tamanho_da_tatuagem (tattoo_size), notas (notes),
status_pt (CASE pending→agendado, confirmed→confirmado,
           completed→concluido, cancelled→cancelado, no_show→no_show),
valor (total_eur), comissao_pct (commission_pct),
comissao_eur (round(total_eur * commission_pct / 100, 2)),
ghl_contact_id, ghl_calendar_id (calendar_id), criado_em (created_at)
```

Parâmetros: `p_month int`, `p_year int`, `p_artist uuid DEFAULT NULL`, `p_status text DEFAULT NULL` (aceita valor PT, traduz para enum), `p_style text DEFAULT NULL` (ILIKE em `tattoo_style`).

Regra de acesso dentro da função:
- `current_user_role() = 'admin'` → vê tudo; filtros aplicados livremente.
- `current_user_role() = 'artist'` → força `artist_id = current_artist_id()`, **omite `valor`, `comissao_pct`, `comissao_eur`** (retorna NULL nessas colunas).
- Qualquer outro → `RAISE EXCEPTION`.

`GRANT EXECUTE ... TO authenticated`.

## 3. Hook `src/hooks/use-monthly-report.ts`

- `useMonthlyReport(filters)` chama `supabase.rpc('get_monthly_report', ...)` via TanStack Query (`queryKey: ['monthly-report', filters]`).
- Expõe `data`, `isLoading`, `error`, `refetch`.
- Função `exportCSV(rows)` — gera CSV client-side (BOM UTF-8, `;` separador, escape de aspas) e dispara download via `Blob` + `URL.createObjectURL`. Disponível só para admin (gate no componente).

## 4. Página `/relatorios/agendamentos`

Arquivo: `src/routes/_authenticated/_admin/relatorios.agendamentos.tsx` (gate admin já existe em `_admin/route.tsx`; tatuador acessando vai para `/agenda`).

Layout (AuthShell + tema atual ink-on-paper, sem mudar accent):
- Header: título + botão **Exportar CSV**.
- Filtros (linha responsiva): Mês (1–12), Ano (atual ± 2), Artista (select alimentado por `useArtists`), Status (PT), Estilo (input texto livre — ILIKE).
- Tabela (shadcn `Table`, desktop) + cards empilhados (mobile) com as colunas do RPC.
- Coluna GHL: se `ghl_contact_id` existir → chip clicável com ícone link, abre `Sheet` lateral. Caso contrário → "não vinculado".
- Valor `null` → `—`. Status renderizado via `StatusBadge` existente.
- Estados padronizados (`LoadingState`, `EmptyState`, `ErrorState`).

## 5. Enriquecimento GHL lazy

- Server fn `getGhlContact(ghlContactId)` em `src/lib/ghl-contact.functions.ts`, protegida com `requireSupabaseAuth`, chama o proxy GHL existente (`/contacts/{id}`) e retorna `{ phone, email, source, tags, assignedTo }`.
- `Sheet` da linha usa `useQuery(['ghl-contact', id])` com `staleTime: 5min` (cache local; sem nova chamada ao reabrir).
- Erros do GHL caem em `ErrorState` dentro do Sheet, não derrubam a tabela.

## 6. Navegação

- Adicionar entrada **Relatórios** no `menu` (visível só para admin, usando `useIsAdmin`).
- Adicionar i18n PT/EN/FR para labels, status, colunas e botão de exportar.

## 7. Validação

- `supabase--linter` pós-migration.
- Teste manual: login admin (vê valores + CSV); login tatuador (vê só seus, sem colunas financeiras, sem botão CSV).
- Verificar prerender — rota está sob `_authenticated/_admin`, RPC só roda via componente (não no loader).

---

### Detalhes técnicos

- Tradução de status feita **só na borda** (RPC → PT, input do filtro → enum) para não tocar no enum existente nem em código que já consome `appt_status`.
- `comissao_eur` calculada na RPC (consistente com `appointments_artist_view` e `get_my_artist_appointments`).
- Nenhuma dependência nova; usa shadcn/ui, lucide, sonner, TanStack Query já presentes.
- Tipos TS gerados automaticamente após migration aprovada; hook usa o tipo do RPC via `Database['public']['Functions']['get_monthly_report']['Returns']`.
