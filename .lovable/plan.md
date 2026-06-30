# Importar agendamentos já existentes

Resposta direta: **você não precisa subir nada manualmente**. A sincronização GHL → Supabase já existe (`syncGhlAppointments`) e é exatamente para isso. O único ajuste necessário é deixar a janela de datas configurável, porque hoje ela é fixa em "últimos 7 dias / próximos 90 dias" e perde agendamentos mais antigos.

## Como funciona hoje

- Admin clica em **Sincronizar GHL** em `/financeiro` ou `/reconciliar`.
- O servidor lê todos os artistas ativos com `ghl_calendar_id`, busca eventos no GHL no intervalo configurado e:
  - insere novos em `public.appointments` (upsert seguro, sem sobrescrever financeiro);
  - atualiza horário/status/contato dos já existentes;
  - registra falhas em `ghl_sync_failures` para a tela de reconciliar.
- Cada appointment já fica vinculado a `artist_id`, `calendar_id`, `ghl_contact_id`, `contact_name`, `start_at`, `end_at`, `status` e `commission_pct` do artista.

## Pré-requisito no GHL (informações mínimas por cliente)

Para que o sync identifique corretamente, cada evento no GHL precisa de:
1. **Calendário do artista correto** (o `calendarId` precisa bater com `artists.ghl_calendar_id` no Supabase — já está seedado).
2. **Contato vinculado** (`contactId`) com pelo menos **nome + (telefone OU email)**.
3. **Start/End time** definidos.
4. **Status** (`confirmed`, `showed`, `noshow`, `cancelled`, `new`).

Campos opcionais que **não** vêm do GHL e ficam vazios no Supabase: `total_eur` (valor), `services`, `tattoo_style`, `tattoo_size`. Quem preenche isso é o checkout no app. Se quiser histórico financeiro também, dá pra editar depois pelo `/relatorios/agendamentos` (proponho um modo de edição numa próxima sprint — fora desse plano).

## Ajuste proposto neste plano

Adicionar **controle de janela** no botão "Sincronizar GHL" para permitir backfill:

1. **`src/lib/sync.functions.ts`** — `runGhlSync` passa a aceitar `inputValidator` opcional:
   - `pastDays` (int, 1–730, default 7)
   - `futureDays` (int, 0–365, default 90)
   - Mantém o gate de admin.

2. **`src/components/sync-ghl-button.tsx`** — vira um `DropdownMenu` (ou popover pequeno) com presets:
   - "Atualizar (padrão)" → 7 / 90
   - "Backfill 30 dias"
   - "Backfill 90 dias"
   - "Backfill 12 meses" (365 / 90)
   - Mantém o spinner, toast de resumo e invalidação de queries existentes.

3. **i18n PT/EN/FR** — labels dos presets em `common.sync.*`.

Sem migration. Sem mudança em RLS. Sem novo endpoint. Só estender a server fn que já existe e melhorar a UX do botão.

## O que você faz depois

1. Confirma que os contatos antigos têm `contactId` e estão atribuídos ao calendário do artista certo no GHL.
2. Em `/reconciliar`, escolhe **Backfill 12 meses** uma vez.
3. Toast mostra `fetched / inserted / updated / failures`. Falhas aparecem como cards acionáveis na mesma tela.
4. `/financeiro`, `/agenda` e `/relatorios/agendamentos` passam a refletir o histórico imediatamente (queries são invalidadas automaticamente).

## Fora deste plano (posso fazer em seguida se quiser)

- Tela de **importação CSV** (para clientes que **não** estão no GHL).
- Modo de **edição financeira** em `/relatorios/agendamentos` para preencher `total_eur` retroativo.
