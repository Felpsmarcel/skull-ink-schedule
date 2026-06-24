## Objetivo
Validar que o novo `GHL_TOKEN` (com todos os scopes) destrava as 4 chamadas que retornavam 401, e fazer um teste real de ponta a ponta criando um agendamento na agenda Randevu.

## Passos

### 1. Redeploy do `ghl-proxy`
Reimplantar a edge function para garantir que o novo valor do segredo `GHL_TOKEN` seja carregado pelo runtime.
- Ferramenta: `supabase--deploy_edge_functions` com `["ghl-proxy"]`.

### 2. Testes individuais via `supabase--curl_edge_functions`
Disparar uma chamada por endpoint, no calendário Randevu (`NzAYeRNJnvfpu7ynyoEK`) ou no location `9iqrKUVPDddINb9S4Iwd`, e reportar status HTTP literal + versão do header `Version` usado.

| # | Função | Path GHL | Method | Version |
|---|--------|----------|--------|---------|
| a | getFreeSlots (controle) | `/calendars/NzAYeRNJnvfpu7ynyoEK/free-slots` | GET | `2021-04-15` |
| b | getEvents | `/calendars/events` | GET | `2021-04-15` |
| c | searchContacts | `/contacts/search` | POST | `2021-07-28` |
| d | createContact | `/contacts/` | POST | `2021-07-28` |
| e | createAppointment | `/calendars/events/appointments` | POST | `2021-04-15` |

Para cada uma:
- Reportar status HTTP real (200 ou erro).
- Se ≠ 200 → colar o **body completo literal** da resposta GHL (sem resumir) e o header `Version` enviado.

### 3. Teste E2E real na agenda Randevu
Sequência:
1. `searchContacts` por um telefone/email de teste (ex.: `+32499000000` / `lovable-test@gf.local`).
2. Se não existir, `createContact` com nome "Lovable Test", telefone e email acima → guardar `contactId`.
3. `getFreeSlots` no Randevu para os próximos 7 dias → escolher o primeiro slot disponível.
4. `createAppointment` no `calendarId NzAYeRNJnvfpu7ynyoEK` com `locationId 9iqrKUVPDddINb9S4Iwd`, `contactId` do passo 2, `startTime`/`endTime` do slot, `title: "Teste Lovable — pode apagar"`, `appointmentStatus: "confirmed"`.
5. Confirmar via `getEvents` no mesmo intervalo que o evento aparece com o `id` retornado.

### 4. Relatório final
Item por item, somente o que realmente retornou 200:
- [ ] Redeploy OK
- [ ] getFreeSlots → status
- [ ] getEvents → status
- [ ] searchContacts → status
- [ ] createContact → status (+ contactId se 200)
- [ ] createAppointment → status (+ appointmentId se 200)
- [ ] Confirmação via getEvents → evento visível? sim/não
- Erros completos colados literalmente quando houver

## Observações
- Nenhum código de aplicação é alterado nesta fase — só deploy + chamadas de teste via tooling.
- O contato/agendamento de teste fica no GHL; você pode apagar depois (vou indicar os IDs).
