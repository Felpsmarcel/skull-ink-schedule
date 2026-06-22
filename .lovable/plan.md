## RAIO-X do app — estado real (sem implementar nada)

### 1. Arquitetura real — de onde cada tela lê

| Tela / dado | Fonte real | Como |
|---|---|---|
| **Lista de artistas** (agenda + novo agendamento + checkout) | **Supabase** tabela `artists` | `useArtists()` → `supabase.from("artists").select(...).eq("active",true).not("ghl_calendar_id","is",null)` |
| **Lista de serviços** (`/appointments/new/services`) | **Supabase** tabela `services` | `fetchActiveServices()` em `src/lib/services.ts` |
| **Slots livres** | **GHL Calendar API** | `getFreeSlots(calendarId,…)` → edge function `ghl-proxy` → `GET /calendars/{id}/free-slots` |
| **Busca de contactos** | **GHL Contacts API** | `searchContacts(locationId, q)` → `POST /contacts/search` |
| **Criar contacto** | **GHL Contacts API** | `createContact(...)` → `POST /contacts/` |
| **Criar agendamento** | **GHL Calendar Events API** | `createAppointment(...)` → `POST /calendars/events/appointments` |
| **Eventos do dia (agenda)** | **GHL Calendar Events API** | `getEvents(calendarId, loc, start, end)` → `GET /calendars/events` |

Resumindo: **só `artists` e `services` saíram para o Supabase. Tudo o resto (slots, contactos, eventos) continua 100% GHL via edge function `ghl-proxy`.**

---

### 2. Supabase — uso real hoje

**Tabelas consultadas pelo app:**
- `artists` — leitura (hook `use-artists`)
- `services` — leitura (`fetchActiveServices`)

**Tabelas que existem no schema mas NÃO são tocadas por nenhum código do frontend:**
`app_users`, `appointments`, `appointment_services`, `availability_blocks`, `contacts`, `payments`, `portfolio`, `quotes`.

Não há nenhuma chamada às tabelas `compromissos` / `contatos` (que ficaram adiadas — `appointments`/`contacts` no schema novo) — confirmado.

**Cliente Supabase:** `anon key` (client-side), via `VITE_SUPABASE_PUBLISHABLE_KEY`. Não há uso de service role no frontend. A edge function `ghl-proxy` só lê o secret `GHL_TOKEN`, não usa nada do Supabase.

**RLS:** ativo nas 10 tabelas, mas em **modo dev permissivo para `anon`** (foi o que combinamos). As funções `current_user_role()` / `current_artist_id()` existem mas o app ainda não usa o conceito de "usuário logado" (ver §3).

---

### 3. Autenticação

- **Não existe login no app.** Nenhuma rota usa `_authenticated/`, nenhum componente chama `supabase.auth.getUser()`, nenhum guarda de rota.
- **Não há integração GHL postMessage / iframe SSO.** O app não sabe quem está usando — qualquer pessoa que abre a URL tem acesso total.
- Tabela `app_users` está vazia (nunca foi inserida nenhuma linha; não há fluxo de signup nem seed).
- O acesso a dados sensíveis depende inteiramente do `GHL_TOKEN` no backend e das policies permissivas do Supabase.

→ **Este é o maior gap de segurança hoje.** Em produção é obrigatório fechar isso antes de expor publicamente.

---

### 4. Fluxo de agendamento — estado real

| Etapa | Funciona? | Observação |
|---|---|---|
| Botão "+" na agenda → `/appointments/new` | ✅ | `navigate({ to: "/appointments/new" })` |
| Busca de contacto (2+ letras) → GHL | ⚠️ provavelmente sim | `POST /contacts/search` está cabeado. Não vi um teste real recente nos logs de rede capturados. |
| Criar novo contacto → GHL | ⚠️ idem | `POST /contacts/` cabeado; sem confirmação visual de teste recente. |
| Seleção de artista | ✅ | Lista os 4 artistas do Supabase (Andre, Gabriel, Maciel, Neto). |
| Slots livres do artista escolhido | ⚠️ **parcial** | A chamada `free-slots` retorna **200 OK mas com `data: { traceId }` e sem nenhum dia/slot** — provavelmente porque o calendário GHL daqueles 4 IDs não tem disponibilidade configurada para essas datas, ou o token não tem o scope completo de slots por calendário. Resultado: usuário vê "sem slots". |
| Seleção de serviço (`/appointments/new/services`) | ✅ | 24 serviços em 6 categorias, agrupados, com faixa de preço e `description_short`. |
| Salvar → cria no GHL Calendar | ❓ não confirmado em produção | O código está pronto (`createAppointment` + revalidação do slot). Não há evidência nos logs de uma chamada `POST /calendars/events/appointments` bem-sucedida ainda. |
| Botões "Pay now" / "Finalize" no `/checkout` | ❌ stubs | Mostram `toast("comingSoon")`. |

---

### 5. O que está quebrado / incompleto

**Erros conhecidos confirmados nos logs de rede capturados:**

- **`GET /calendars/events` → 401 "The token is not authorized for this scope"** — para os 4 calendários, em todas as chamadas. Isso significa que **a agenda principal (`/agenda`) NÃO consegue mostrar eventos já agendados**. Mostra só free-slots vs. "sem booking", nunca "ocupado". É um problema de permissões do token GHL (falta o scope `calendars/events.readonly` no PIT/OAuth).
- **`free-slots` retorna `{ traceId }` sem slots** — para todos os 4 calendários nas datas testadas. Pode ser: (a) calendário sem horário configurado no GHL, (b) data fora da janela de disponibilidade, (c) o mesmo problema de scope. Resultado visível: agenda mostra todos os horários como "sem booking" mas sem confiança de que isso é real.

**Incompleto / stub:**
- Todo o bottom-nav exceto "Agenda" e "+": Services, Reviews, Menu → `toast(comingSoon)`.
- Header da agenda: Chat, Notificações, Perfil → `comingSoon`.
- Recorrência no novo agendamento: desabilitada (`disabled`, só "no repeat").
- Pay now / Finalize no checkout → `comingSoon`.
- Editar/cancelar agendamento existente: não existe.
- Bloquear horário (availability block): não existe (tabela criada, sem UI).
- Quotes/orçamentos: tabela criada, sem UI.
- Pagamentos: tabela criada, sem UI nem integração de gateway.
- Portfolio: tabela criada, sem UI nem upload (sem bucket de storage).
- Painel admin/perfil: inexistente.
- i18n: chaves criadas em PT/EN/FR mas sem seletor de idioma na UI.

**Telas que não existem como rota:**
`/services` (catálogo standalone), `/contacts`, `/clients/:id`, `/settings`, `/portfolio`, `/quotes`, `/login`, `/auth`.

---

### 6. Os 24 produtos GHL

**Não estão a ser usados em nenhum lugar do app.**
- Não há nenhuma chamada para `/products/*` da GHL.
- Não há mapeamento entre `services.id` do Supabase e qualquer `productId` do GHL (nem coluna `ghl_product_id` na tabela).
- O título do agendamento criado no GHL é a concatenação `service.name + " + " + ...`, não um `productId`.

→ Os 24 produtos no GHL servem hoje **apenas para faturação/orçamentos no CRM nativo**. O app trabalha com a sua própria cópia em `public.services` e ignora os products do GHL.

Se quiseres que o agendamento criado no GHL fique vinculado aos products (para puxar preço/IVA no invoice nativo), é um trabalho extra: adicionar `ghl_product_id` em `services`, popular a coluna, e passar isso ao criar o appointment ou ao gerar invoice.

---

### Conclusão honesta — o que está sólido, o que é maquete

**Sólido (ponta a ponta funcional):**
- Catálogo de artistas (Supabase)
- Catálogo de serviços com 24 itens, agrupados, com faixas de preço (Supabase)
- Edge function `ghl-proxy` com `GHL_TOKEN` seguro
- Fluxo de UI completo para criar um agendamento

**Maquete / não-funcional / bloqueado:**
- **Eventos da agenda (booked slots)** — bloqueado por scope do token GHL
- Free-slots retornando vazio nas datas testadas — investigar config dos calendários GHL
- Pagamentos, recorrência, edição, cancelamento, bloqueio de horário
- Auth (não existe)
- Toda a aba inferior fora de Agenda+Novo

**Próximos passos sugeridos (em ordem de impacto, para tu decidires):**
1. **Resolver o 401 do `/calendars/events`** — sem isso a agenda principal está cega.
2. Investigar por que `free-slots` retorna vazio (config dos calendários no GHL).
3. Decidir sobre auth: ficar admin-fixo + RLS aberta (rápido, inseguro) **ou** implementar login Supabase + roles agora.
4. Decidir se os 24 products GHL devem ficar amarrados aos `services` (para faturação).
5. Só depois: editar/cancelar appointment, bloqueio de horário, pagamentos.

Me diz por onde queres atacar e eu volto com um plano focado.