## Decisões fixadas

- **Serviços**: tabela `public.services` no Supabase. **Bloqueante:** você ainda precisa me mandar a lista real no formato `Nome | Categoria | Duração min | Modalidade | Preço €`. Sem isso a tela "Selecionar serviço" fica vazia (não vou inventar mock).
- **Criar contato**: sim, formulário cria contato real no GHL via `POST /contacts/`. Requer scope `contacts.write` no `GHL_TOKEN` — se faltar, o backend retorna 401 e o app mostra o erro.
- **Header Version GHL (confirmado na doc atual)**:
  - `POST /contacts/` → `Version: 2021-07-28`
  - `POST /calendars/events/appointments` → `Version: 2021-04-15`
  - `GET /contacts/search` → `Version: 2021-07-28`
- **Recorrência**: só "Não se repete" nesta etapa.
- **Pagar agora / Finalizar**: só visual nesta etapa (sem efeito).

## Migration (Supabase)

Tabela `public.services`:
- `id` uuid PK
- `name` text NOT NULL
- `category` text NOT NULL
- `duration_min` int NOT NULL CHECK (`duration_min` > 0)
- `modality` text NOT NULL (presencial/online/etc.)
- `price_cents` int NOT NULL CHECK (`price_cents` >= 0)
- `currency` text NOT NULL default `'EUR'`
- `active` boolean NOT NULL default true
- `created_at` / `updated_at` timestamps + trigger
- GRANTs: `SELECT` para `anon` + `authenticated` (catálogo público em modo admin fixo); `ALL` para `service_role`
- RLS ON: policy `SELECT` aberta enquanto não há auth real

Sem seed agora — quando você mandar a lista, abro 1 migration de INSERT.

## Edge function `ghl-proxy`

Já existe e é genérica (path + method + query + body + version). NÃO precisa mudar. Os 3 endpoints novos passam por ela:

- `GET /contacts/search?locationId=...&query=...` (Version 2021-07-28)
- `POST /contacts/` body `{ locationId, firstName, lastName, phone, email }` (Version 2021-07-28)
- `POST /calendars/events/appointments` body `{ calendarId, locationId, contactId, startTime, endTime, title, appointmentStatus: "confirmed", ignoreFreeSlotValidation: false }` (Version 2021-04-15)

## Camada cliente (`src/lib/ghl.ts`)

Adicionar:
- `searchContacts(query: string)` → `GET /contacts/search`
- `createContact(input)` → `POST /contacts/`
- `createAppointment(input)` → `POST /calendars/events/appointments` + retorna `{ id, startTime, endTime, ... }` ou erro tipado
- Reutiliza `getFreeSlots` para validar slot livre antes do `createAppointment`

## Rotas novas (3 telas)

```text
src/routes/
  appointments.new.tsx            → /appointments/new        Tela "Novo agendamento"
  appointments.new.services.tsx   → /appointments/new/services  Tela "Selecionar serviço"
  appointments.new.checkout.tsx   → /appointments/new/checkout Tela "Detalhe / Checkout"
```

Estado compartilhado entre as 3 telas via **Zustand store** `useAppointmentDraft` (cliente, calendarId, start ISO, slots de serviços com preços finais/desconto, notas). Persistido em `sessionStorage` para sobreviver a refresh entre telas. Limpa ao finalizar / cancelar.

### Tela 1 — `/appointments/new`
- Card "Adicionar cliente": botão abre `<Drawer>` com:
  - input de busca → debounce 300ms → `searchContacts(query)` → lista com avatar inicial + nome + telefone.
  - aba "Criar novo": form Zod (nome*, telefone*, e-mail) → `createContact` → seleciona o contato criado.
- Select obrigatório do tatuador (lê `STAFF` do `src/config/staff.ts`).
- DatePicker (shadcn) + lista de horários livres do calendário escolhido na data escolhida (reusa `getFreeSlots`).
- Select recorrência (só "Não se repete" disabled-locked nas demais).
- Seção "Serviços" lista os já adicionados (do store) + botão "Adicionar serviço" → navega para `/appointments/new/services`.
- Footer fixo: menu (kebab desabilitado), "Checkout" (navega `/appointments/new/checkout`), "Salvar" (primary).
- **"Salvar"**: valida (cliente, calendar, start), revalida slot via `getFreeSlots` filtrando o `start` selecionado, chama `createAppointment`. Em sucesso: `queryClient.invalidateQueries({ queryKey: ["agenda"] })`, limpa store, toast "Agendamento criado", navega para `/agenda` na data do appointment.

### Tela 2 — `/appointments/new/services`
- Header com back + input de busca.
- Query `useServices()` → `SELECT * FROM services WHERE active ORDER BY category, name`.
- Lista agrupada por `category` com contador `(n)` no header.
- Cada item: nome, `duration_min`, `modality`, preço formatado em € (`Intl.NumberFormat('pt-PT', { style:'currency', currency:'EUR' })`).
- Toque adiciona ao draft (pode adicionar vários, podendo aplicar desconto manual depois no checkout) e volta para tela 1.

### Tela 3 — `/appointments/new/checkout`
- Header: avatar + nome + telefone do cliente + ações `tel:` e `mailto:`.
- Linha resumo data/horário + tatuador.
- Lista de serviços: nome, preço original riscado quando houver desconto, preço final em destaque. Campo numérico opcional "desconto %" por serviço (atualiza preço final no store).
- Textarea "Notas internas" (max 1000) → vai como `notes` no `createAppointment`.
- Totais: original riscado + final em destaque.
- Botões "Pagar agora" e "Finalizar" → ambos só disparam `toast("Em breve — próxima etapa")` por enquanto.

## Validação real de slot

Antes de `createAppointment`:
1. `getFreeSlots(calendarId, dayStartMs, dayEndMs)` da data.
2. Confere se `startISO` selecionado está na lista de starts livres.
3. Se não estiver → toast "Slot já ocupado, escolha outro" + recarrega horários.
4. Se estiver → `createAppointment`. Em caso de 409/422 do GHL → mesmo tratamento.

## Atualização da agenda

`createAppointment` em sucesso → `queryClient.invalidateQueries({ queryKey: ["agenda"] })`. O refetch automático de 2 min já existe; a invalidação força refetch imediato.

## Bottom nav "+"
- O botão `+` central da agenda já existe (hoje mostra toast "em breve"). Vou conectar ele a `navigate({ to: "/appointments/new" })`.

## Fora de escopo desta etapa

- Recorrência além de "não se repete"
- Pagamento real / funil de checkout
- Cancelar / editar appointment existente
- Login real / perfis (continua admin fixo)
- Categorias/serviços CRUD no app (gerencia por SQL/migrations)

## Como testar (depois de eu implementar + você me mandar a lista de serviços e eu rodar o seed)

1. **Pré-requisito de scope**: garantir que `GHL_TOKEN` tem `contacts.readonly`, `contacts.write`, e `calendars/events.write`. Se faltar, o app mostra o erro bruto do GHL — me avise que peço update do secret.
2. **Mandar lista de serviços** → eu rodo migration de INSERT.
3. Abrir `/agenda`, tocar no botão `+` → cai em `/appointments/new`.
4. **Adicionar cliente**:
   - Buscar por nome conhecido no GHL → confirmar que aparece.
   - Aba "Criar novo": preencher nome/telefone/e-mail → confirmar que cria. **Conferir no painel do GHL** que o contato apareceu em Contacts.
5. Selecionar tatuador, escolher data, escolher horário livre.
6. "Adicionar serviço" → cai em `/appointments/new/services`. Buscar/filtrar/escolher.
7. (Opcional) Ir em "Checkout", aplicar desconto, anotar nota.
8. Voltar e tocar **Salvar** → toast de sucesso → cai na `/agenda` na data escolhida.
9. **Conferir no GHL** que o appointment aparece em `Calendars → Appointments` no calendário do tatuador.
10. **Conferir na agenda do app**: o slot deve aparecer ocupado com nome do cliente. Refazer um novo agendamento no mesmo slot deve dar "Slot já ocupado".

## Arquivos afetados

- `supabase/migrations/<ts>_services.sql` (nova tabela)
- `src/lib/ghl.ts` (3 funções novas)
- `src/lib/services.ts` (query Supabase do catálogo)
- `src/stores/appointment-draft.ts` (Zustand)
- `src/routes/appointments.new.tsx`
- `src/routes/appointments.new.services.tsx`
- `src/routes/appointments.new.checkout.tsx`
- `src/routes/agenda.tsx` (conectar botão `+`)
- `src/i18n/locales/{pt,fr,en}.json` (chaves de appointment)
- `src/routeTree.gen.ts` (auto)

## Dependência bloqueante

Para terminar de verdade preciso de duas coisas suas:
1. Lista real de serviços no formato pedido.
2. Confirmação de que o `GHL_TOKEN` tem os scopes `contacts.readonly`, `contacts.write`, `calendars/events.write` (ou liberar agora).

Posso implementar TUDO menos o seed de serviços sem essas duas — me diga se prefere que eu já comece e você manda a lista em paralelo, ou se prefere mandar primeiro.
