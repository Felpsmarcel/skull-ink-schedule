## Decisões fixadas pelas suas respostas

- **Auth**: continua admin fixo. RLS fica ENABLED em tudo (como mandou), mas adiciono policies **permissivas para `anon`** nas tabelas que o app realmente lê HOJE (`services`, `artists`). As policies admin/artist do schema v1.0 ficam criadas mas só passam a valer quando login existir.
- **Artists**: semeio Gabriel, Andre, Neto, Maciel com os IDs reais que mandou. Joyce fica de fora (sem IDs).
- **Serviços**: aguardo a lista (você disse que vai colar). Migration de schema roda agora; INSERT de services roda depois numa segunda migration.
- **Mirror GHL**: appointments/contacts/payments/quotes ficam **dormentes** nesta etapa. Crio as tabelas (estão no schema v1.0), mas a tela de novo agendamento continua escrevendo **só no GHL** via proxy. Sem dual-write agora.

## Conflito com schema atual — precisa resolver

Hoje existe `public.services` com `price_cents int`. O schema novo usa `price_eur numeric(8,2)` + coluna nova `description` + `sort_order` + enum `service_modality`. **Não dá pra alterar in-place sem perder/converter dados.** Como a tabela está vazia (sem seed ainda), vou:

1. `DROP TABLE public.services CASCADE`
2. Recriar com o shape novo do schema v1.0

Se você já tivesse inserido linhas, eu faria `ALTER` preservando, mas como está vazia, drop+recreate é mais limpo.

## Migration 1 — Schema v1.0 (tudo de uma vez)

Rodo exatamente o SQL que você mandou, com 3 ajustes obrigatórios pro Supabase:

1. **`DROP TABLE public.services CASCADE`** no topo (antes do `create type`), porque a tabela já existe com shape antigo.
2. **GRANTs explícitos** em todas as 10 tabelas (Supabase Data API não dá grant default em `public`):
   - `services`, `artists` → `GRANT SELECT ON ... TO anon, authenticated` + `GRANT ALL ... TO service_role` (catálogo público enquanto não há login)
   - `app_users`, `contacts`, `appointments`, `appointment_services`, `quotes`, `payments`, `portfolio`, `availability_blocks` → `GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated` + `GRANT ALL TO service_role`. Sem `anon` (essas dependem de login).
3. **Policy permissiva temporária pra `anon`** em `services` e `artists` (`USING (true)` no SELECT). As policies admin/artist do v1.0 entram como você mandou, mas como `current_user_role()` retorna NULL sem `app_users` populado, elas só vão valer pós-login.

Sem outras mudanças no SQL — enums, tabelas, índices, triggers `set_updated_at`, funções `current_user_role()` / `current_artist_id()` e todas as policies ficam exatamente como você escreveu.

## Migration 2 — Seed de artists

Idêntico ao que você mandou, **sem Joyce**:

```sql
insert into artists (ghl_user_id, ghl_calendar_id, name, email, phone, specialties, active) values
  ('bFfSIHXorhaCUvcM0UIU', '9PS3KanirlXnDSO63ZYY', 'Gabriel Fernandes', 'contatodegabriel@gmail.com', '+5571992036764', '{"Cover-up","Blackwork"}', true),
  ('FMju5MHBXiXOzLXtBrA2', 'suBooHKzS7WTsdHOIiHJ', 'Andre Pareyn', 'andrepareyn7508@gmail.com', '+32465271070', '{}', true),
  ('FZBsfiRSCzfviKR3fEVh', '8YftfNNqLrONHHP2RQkd', 'Neto Mendes', null, null, '{}', true),
  ('MmNZUW7IedFpLJ3SYNLQ', 'BMolaQM8M3kQDiKxFNxZ', 'Maciel Tattoo', null, null, '{}', true);
```

Joyce: assim que me mandar os 2 IDs, abro migration de 1 linha.

## Migration 3 — Seed de services (DEPOIS que você colar a lista)

Vou converter `Nome | Categoria | Duração | Modalidade | Preço €` em `INSERT INTO services (name, category, duration_min, modality, price_eur, sort_order) VALUES ...`. Sem isso, a tela "Selecionar serviço" continua vazia.

## Refactor de código

### `src/config/staff.ts` → vira hook

Hoje é um array hardcoded `STAFF` com 5 tatuadores. Substituo por:

- **Novo `src/hooks/use-artists.ts`** com `useQuery(["artists"], fetchActiveArtists)` lendo `SELECT id, ghl_user_id, ghl_calendar_id, name, avatar_url, specialties FROM artists WHERE active = true ORDER BY name`.
- Mantenho `src/config/staff.ts` como **shim retrocompatível** exportando o tipo `Staff` mapeado a partir do row do Supabase (`calendarId` ← `ghl_calendar_id`, `userId` ← `ghl_user_id`), ou removo de vez e atualizo os 3 imports atuais. Decido pelo segundo (menos código morto).

### Arquivos afetados pelo refactor de staff
- `src/config/staff.ts` → deletado
- `src/hooks/use-agenda.ts` → recebe lista de artists do hook em vez de importar `STAFF`
- `src/routes/agenda.tsx` → idem
- `src/routes/appointments.new.tsx` → idem (select de tatuador)

### `src/lib/services.ts` → adaptar shape novo

Mudanças:
- Tipo `Service`: `price_cents` → `price_eur: number`, adicionar `description?: string`, `sort_order: number`, `modality: "presencial" | "consulta_online" | "hibrido"` (enum, não string livre).
- `fetchActiveServices`: `ORDER BY sort_order, category, name`, select inclui `description, sort_order`.
- `formatPrice(eur: number)`: passa a receber euros direto (`Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(eur)`), sem `/100`.

### Store de draft (`src/stores/appointment-draft.ts`)

`DraftServiceLine.service` agora referencia o novo shape. Cálculos de total mudam de centavos para euros (multiplicação em ponto flutuante com `toFixed(2)` na exibição). Como persist está em `sessionStorage`, **adiciono `version: 2` no persist** pra invalidar drafts antigos automaticamente em quem já abriu o app.

### Telas

- **`/appointments/new/services`**: usa `price_eur` direto + mostra `description` em cinza pequeno abaixo do nome quando existir.
- **`/appointments/new/checkout`**: cálculo de desconto em euros (não em centavos). `discount_eur` no draft passa a refletir a coluna nova do schema (mesmo nome).
- **`/appointments/new`** (tela 1): select de tatuador alimentado pelo `useArtists()`. Avatar usa `avatar_url` quando existir, senão inicial do nome.

### i18n
Sem chaves novas — só ajusto a chave de "modalidade" se quiser mostrar label localizada (`presencial` / `consulta_online` / `hibrido` → `Presencial` / `Consulta online` / `Híbrido`).

## Fora de escopo desta etapa (confirmado por você)

- Auth real (`app_users`, login, Google) — fica dormente, schema pronto pra ativar depois.
- Dual-write Supabase ↔ GHL — appointment continua escrevendo só no GHL via proxy.
- CRUD admin de artists/services dentro do app — gerencia via migration por enquanto.
- Joyce no seed — aguarda IDs.
- Portfolio, payments, quotes, availability_blocks — tabelas existem mas nenhuma tela consome.

## Pendências bloqueantes (de você)

1. **Lista de serviços** no formato `Nome | Categoria | Duração min | Modalidade | Preço €` — sem isso, tela de serviços fica vazia.
2. **IDs do GHL pra Joyce** (`ghl_user_id` + `ghl_calendar_id`) se quiser ela no app agora.
3. **Confirmar drop+recreate da `services`** — a tabela atual está vazia, mas quero seu OK explícito antes de DROP CASCADE.

## Como testar depois de tudo aplicado

1. **Migration 1** rodada → confere no painel do backend que existem as 10 tabelas + enums.
2. **Migration 2** rodada → abrir `/agenda` → o select de tatuador deve mostrar Gabriel, Andre, Neto, Maciel (sem Joyce). Cada um carrega os events do calendário GHL correto.
3. **Migration 3** rodada (depois da lista) → tocar `+` → adicionar cliente → escolher tatuador/slot → "Adicionar serviço" → lista agrupada por categoria com preços em €.
4. **Salvar agendamento** → confere no GHL que o evento aparece no calendário do tatuador.
5. **RLS sanity check**: rodar no SQL editor `SET ROLE anon; SELECT * FROM services;` → deve retornar linhas. `SELECT * FROM appointments;` → deve retornar zero linhas (sem grant pra anon), confirmando que dados sensíveis ficam fechados.

## Ordem de execução (proposta)

1. Migration 1 (schema + drop services antigo + grants + policies)
2. Migration 2 (seed artists)
3. Refactor de código (staff hook, services lib, store, telas) — não depende de Migration 3
4. **PAUSA** esperando lista de serviços
5. Migration 3 (seed services)
6. Teste end-to-end

Posso começar 1→2→3 em sequência assim que você aprovar este plano e confirmar o drop da `services`. Migration 3 fica em pé até você colar a lista.