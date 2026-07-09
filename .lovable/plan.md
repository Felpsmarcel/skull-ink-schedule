# Diagnóstico de otimização

Foco em três eixos: **performance (backend + rede)**, **UX** e **dados/cálculos**. Priorizado por impacto × esforço. Nada é aplicado ainda — é só um mapa; podemos executar por etapas.

---

## 1. Performance — problemas concretos identificados

### 1.1 `getFinanceSummary` (admin) faz round-trips desnecessários

Arquivo: `src/lib/finance.functions.ts`

- Busca **todos os appointments sem filtro de período** (`.order("start_at").select(...)`) — a tabela crescerá indefinidamente. Hoje a filtragem por Hoje/Semana/Mês é feita **no cliente** em `financeiro.tsx`.
- Faz uma **segunda query** (`fetchOverrideMap`) para pegar `manual_payment_status`, coluna que já poderia vir no primeiro `select` (ou já vem no caso admin, mas o helper roda mesmo assim para artist/seller).
- Busca **todos os `payments` com `status='paid'**` globalmente para montar `paidIds` — sem escopo por appointment; cresce linear com o histórico.
- Para artist/seller: RPC + query extra de overrides sem `.in(ids)` limitado a IDs relevantes já retornados.

**Ação:**

- Adicionar parâmetros `from` / `to` no `getFinanceSummary` e mover o filtro de período para o servidor (SQL `WHERE start_at >= from AND < to`).
- Escopar `payments` com `.in("appointment_id", ids)` após buscar appointments.
- Eliminar `fetchOverrideMap` para artist/seller: alterar as RPCs `get_my_artist_appointments` / `get_my_seller_appointments` para retornar `manual_payment_status`.
- Retornar `sellerName`/`sellerCommissionEur` já pronto via JOIN em vez de segunda query `sellers.in(ids)`.

### 1.2 UPDATE em `appointments` por `ghl_appointment_id` — 308k execuções

`supabase--slow_queries` mostra que a query mais custosa é `UPDATE appointments ... WHERE ghl_appointment_id = $2` (66s totais). Sem índice único explícito, cada UPDATE faz seq scan quando a tabela cresce.

**Ação:** criar índice `CREATE UNIQUE INDEX IF NOT EXISTS appointments_ghl_appointment_id_uidx ON public.appointments (ghl_appointment_id)`.

### 1.3 Agenda: chamadas GHL não cacheadas no servidor

`use-agenda.ts` faz `getFreeSlots` + `getEvents` por artista por dia direto no cliente contra o GHL. Em N artistas visíveis = 2·N chamadas + rate-limit risk. `staleTime` de 60s + polling 120s.

**Ação (fase 2, opcional):** mover para um `createServerFn` com um cache curto (KV/memória do worker por 30–60s) ou consolidar num único fetch por dia (batch multi-artist).

### 1.4 `useFinanceSummary` refetch agressivo

`staleTime: 30_000` na hook + invalidações em toda mutação. Como cada mudança já invalida, subir `staleTime` para 2–5 min reduz refetches ociosos.

### 1.5 Renders da tabela

`AdminView` renderiza a tabela inteira sem virtualização nem `React.memo`. Só relevante quando passar de ~200 linhas — colocar na fase 3.

---

## 2. UX — tela Financeiro

- **Filtros na URL** (`?period=week&bucket=pago`): `validateSearch` + `Route.useSearch()` — hoje é `useState`, então não dá para compartilhar link nem voltar do detalhe mantendo estado.
- **Ordenação por coluna** (Data, Total, Comissão, Status): hoje é fixa desc por `start_at`.
- **Busca por cliente/serviço/vendedor** (input com debounce, no cliente sobre `rows`).
- **Filtro por artista** (admin) e **por vendedor** — hoje não existe.
- **Paginação server-side** quando o filtro é "Todos" (limit 50 + cursor). Evita transferir a tabela toda.
- **Exportar CSV** do recorte atual (botão no header).
- **Card "Comissão vendedores"** ocupa a linha toda; melhor colocar junto do grid principal como 4º card no `md:` e esconder quando `= 0`.
- **Densidade mobile**: cards já bons, mas a linha "Vendedor · X" pode virar chip pequeno.
- **Empty state com filtro**: já existe; adicionar botão "Limpar filtros" quando `filtersActive`.
- **Skeleton loader** em vez de `LoadingState` genérico durante refetch mantém a UI estável.

---

## 3. Dados / cálculos

- **Agregações no banco**: criar RPC `get_finance_summary(from, to)` que já devolve totais (SUM) e linhas paginadas — evita trazer N linhas só para somar em JS. Grande ganho quando o histórico crescer.
- **Comissão vendedor** hoje aparece apenas para admin; expor no view do artista quando o serviço foi vendido por um seller relevante (a decidir).
- **Agrupar por mês / por artista** (relatório): já existe `get_monthly_report`. Reaproveitar no Financeiro como aba "Mensal" com barras/linha (recharts) — Total × Comissão × Estúdio.
- **Reconciliar `payments**` para casos com `status='paid'` mas sem appointment vinculado (bucket "pago" nunca aparece). Já existe `/reconciliar`; considerar um badge de contagem no header quando `>0`.
- **Locks (`manualOverride`)**: mostrar tooltip explicando o cadeado.

---

## 4. Ordem sugerida de execução

```text
Fase 1 — ganho grande, risco baixo (1 iteração)
  1. Índice único appointments.ghl_appointment_id
  2. Filtros do Financeiro na URL (validateSearch)
  3. staleTime do useFinanceSummary → 5 min
  4. Escopar payments/sellers por .in(ids)
  5. Remover fetchOverrideMap duplicado (RPCs retornam manual_payment_status)

Fase 2 — refactor server (1–2 iterações)
  6. getFinanceSummary aceita { from, to } e filtra no SQL
  7. Busca + ordenação por coluna + botão "Limpar filtros"
  8. Exportar CSV do recorte atual

Fase 3 — quando o volume justificar
  9. RPC get_finance_summary com agregações + paginação server-side
 10. Cache server-side das chamadas GHL na agenda
 11. Aba "Mensal" com gráfico
```

## O que eu preciso decidir com você antes de mexer

1. Começo pela **Fase 1 inteira** ou só pelas linhas 1–3 (índice + filtros na URL + staleTime)?  
sim
2. Filtro por **artista** e **vendedor** no Financeiro do admin: incluir já na Fase 1?  
sim
3. Botão de **exportar CSV**: sim/não, e com quais colunas?