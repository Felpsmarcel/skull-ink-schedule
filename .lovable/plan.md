## Como impedir que `total_eur` chegue ao frontend do tatuador

Postgres **tem** controle de coluna nativo via `GRANT/REVOKE (coluna) ON tabela`, mas combinar isso com RLS por linha fica frágil (qualquer `select *` do PostgREST quebra para o artista). A abordagem mais robusta e auditável é **duas camadas**:

### Camada 1 — Server functions como única porta de entrada (boundary principal)
Toda leitura de `appointments` no app passa por `createServerFn` com `requireSupabaseAuth`. A função verifica `current_user_role()`:
- **admin** → retorna DTO completo (`total_eur`, `commission_eur`, `studio_eur`, ...).
- **artist** → retorna DTO restrito (`id`, `start_at`, `service`, `commission_eur`) e força `artist_id = current_artist_id()`. Os campos `total_eur` / `studio_eur` simplesmente não existem no objeto serializado — o cliente nunca os recebe na resposta JSON.

### Camada 2 — Defesa em profundidade no banco (caso alguém burle a server fn e chame PostgREST direto com o JWT do artista)
Uma **view `appointments_artist_view`** com `security_invoker=on` que expõe só `id, artist_id, start_at, service_name, commission_eur` (calculada como `total_eur * commission_pct / 100`), e RLS que filtra para `artist_id = current_artist_id()`.

Na tabela base `appointments`, a política SELECT para artist é **reescrita para `USING (false)`** — artista não lê a tabela base de jeito nenhum via Data API. Admin continua com SELECT total. Assim, mesmo um `GET /rest/v1/appointments?select=total_eur` feito com o JWT do Gabriel volta vazio. O artista só consegue ler via `appointments_artist_view` (que não tem a coluna) ou via server fn (que filtra o DTO).

Isso resolve sem depender de GRANT por coluna (que conflitaria com o `select *` que o PostgREST e o supabase-js usam por padrão).

---

## Plano de implementação

### 1. Migração SQL
- Adicionar coluna gerada `commission_eur` (ou calcular na view): `(total_eur * commission_pct / 100)`.
- Criar view `public.appointments_artist_view` (`security_invoker=on`) com apenas: `id, artist_id, contact_id, calendar_id, start_at, end_at, status, service_name, commission_eur, created_at`. **Sem** `total_eur`, **sem** `original_eur`, **sem** `services` (que contém preços).
- `GRANT SELECT ON public.appointments_artist_view TO authenticated`.
- Reescrever política SELECT de `appointments` para artist → `USING (false)`. Manter SELECT total para admin (`has_role(auth.uid(),'admin')`). Manter INSERT/UPDATE do artista nos próprios registros (necessário para `finalizeAppointment`).
- View herda RLS da tabela base via `security_invoker`, então adicionar política dedicada na view não é necessário — mas para clareza criamos: `USING (artist_id = current_artist_id() OR has_role(auth.uid(),'admin'))`. (Views não suportam policies diretamente; o filtro fica embutido no SELECT da view via `WHERE`.)

### 2. Server functions (`src/lib/appointments.functions.ts`, novo arquivo)
- `listMyAppointments()` — middleware `requireSupabaseAuth`. Se admin: lê `appointments` direto. Se artist: lê `appointments_artist_view`. Retorna shape diferente por role (TypeScript union discriminado pelo campo `role`).
- `getAppointmentDetail({ id })` — mesma lógica, filtra DTO por role.
- `getCommissionSummary()` — para artista: agrega `commission_eur` por status (`a_receber`, `pago`, `pendente`) a partir da view + tabela `payments`. Para admin: agrega total + comissão + estúdio.

### 3. Hooks e UI
- `src/hooks/use-my-appointments.ts` e `use-commission-summary.ts` chamando as server fns acima via `useServerFn` + `useQuery`.
- **Nova rota** `src/routes/_authenticated/financeiro.tsx` — painel financeiro:
  - **Artista**: 3 cards (A receber, Pago, Pendente) com soma de comissão; lista de agendamentos com `data | serviço | comissão (40%)`. **Nunca** renderiza `total_eur`.
  - **Admin**: mesma tela mas com colunas `Total | Comissão (40%) | Estúdio (60%)`.
- Atualizar `src/routes/_authenticated/agenda.tsx` (detalhe do agendamento): renderização condicional por role. Artista vê só "Sua comissão: €X". Admin vê breakdown completo.

### 4. Status de pagamento
A tabela `payments` já existe. Para simplificar nesta fase: status derivado por enquanto = `pago` se existe payment.completed_at, `pendente` se appointment.start_at < now() sem payment, `a_receber` caso contrário. (Sem integração Stripe ainda, conforme combinado.)

### 5. Verificação (vou executar e colar o output real)
Logado como Gabriel (`gabriel@gftattoo.test` / `Artist#2026`):
1. `supabase.from('appointments').select('total_eur')` via JWT do artista → esperado: array vazio ou erro RLS.
2. `supabase.from('appointments').select('*')` → esperado: vazio.
3. `supabase.from('appointments_artist_view').select('*')` → retorna linhas dele, **sem** coluna `total_eur` (verifico `Object.keys` no console).
4. Chamada à server fn `listMyAppointments()` → inspeciono payload JSON da resposta no DevTools Network: confirmo ausência de `total_eur`/`studio_eur`.
5. Playwright: navego para `/financeiro` como Gabriel, faço screenshot, faço `grep` no HTML renderizado e na resposta da rede por "total_eur" e pelo valor numérico do total de um agendamento conhecido → ambos devem ser zero matches.
6. Repito como admin → vê total e breakdown.

### Arquivos a criar/editar
- **Migração**: nova migration com view + reescrita de policy SELECT de artist.
- **Criar**: `src/lib/appointments.functions.ts`, `src/hooks/use-my-appointments.ts`, `src/hooks/use-commission-summary.ts`, `src/routes/_authenticated/financeiro.tsx`, `src/components/financeiro/commission-cards.tsx`, `src/components/financeiro/appointments-table.tsx`.
- **Editar**: `src/routes/_authenticated/agenda.tsx` (detalhe condicional), `src/lib/appointments.ts` (apontar leitura para a server fn nova), navegação para incluir link "Financeiro".

### Out of scope (não vou fazer agora)
- Integração Stripe / cobrança real.
- Marcar pagamento como pago manualmente pelo admin (posso adicionar se você pedir, mas não está na sua mensagem).
- Histórico de comissão por período customizado (mês corrente é o suficiente nesta fase).

Confirma que posso seguir com essa abordagem (server fn como porta principal + view sem `total_eur` + RLS `USING(false)` para artist na tabela base)?