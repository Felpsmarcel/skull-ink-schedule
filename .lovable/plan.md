## Objetivo

Permitir trocar o tatuador de um agendamento existente diretamente pelo painel de detalhes (aquele que aparece ao tocar no evento na agenda), sem precisar cancelar e recriar.

## UX

No sheet `AgendaAppointmentSheet`, transformar a linha **TATUADOR** (hoje só texto "GF") em um seletor, no mesmo padrão visual do `SellerPicker` que já existe logo abaixo:

```text
TATUADOR
[ GF ▾ ]     ← Select com a lista de artistas ativos
```

- Ao trocar → confirmação inline ("Reatribuir para {novo nome}?") + botão **Confirmar** para evitar toque acidental.
- Enquanto salva: spinner no Select, resto do sheet desabilitado.
- Sucesso: toast "Tatuador atualizado", sheet recarrega os dados, agenda e financeiro invalidam.
- Erro: toast com mensagem e o Select volta ao valor anterior.

**Permissão:** só `admin` vê o seletor. Artista/vendedor continuam vendo texto plano (comportamento atual). Justificativa: reatribuir move comissão e some da agenda do artista original — decisão administrativa.

**Fora de escopo (MVP):** validar conflito de horário no novo calendário antes de salvar. O aviso de sobreposição já existente (`hasOverlap`) cobre o caso depois, e o GHL aceita a mudança.

## Backend

Uma nova server function em `src/lib/appointments.functions.ts`:

- `reassignAppointmentArtist({ ghlEventId, newArtistId })`
  - `requireSupabaseAuth` + checagem `has_role(admin)`
  - Resolve `artists` → pega `ghl_calendar_id` e `ghl_user_id` do novo artista (falha se algum estiver nulo)
  - Chama GHL `PUT /calendars/events/appointments/{eventId}` com `{ calendarId, assignedUserId }` (helper novo `updateAppointmentEvent` em `src/lib/ghl.ts`, seguindo o padrão dos outros wrappers)
  - Atualiza `public.appointments` do mirror: `artist_id`, `calendar_id`, `updated_at`
  - Retorna `{ ok: true }`; erros do GHL sobem como `Response(..., { status })`

Comissão (`commission_pct`) fica como está no registro — o novo artista herda o valor congelado do agendamento. Se a política tiver que recalcular, é uma decisão de negócio separada; aviso no plano mas não implemento sem confirmação.

## Frontend

`src/components/agenda-appointment-sheet.tsx`:

- Novo componente local `ArtistPicker` (espelho de `SellerPicker`), usa `useArtists()` + `useCurrentUser()` para gate de admin.
- Substitui a `<Row label="TATUADOR" value={staffName} />` quando admin; caso contrário mantém `Row`.
- `useMutation` chamando `reassignAppointmentArtist`, invalida: `["agenda"]`, `["agenda-status"]`, `["appointment-finance", ghlEventId]`, `["ghl-contact", …]`.

`src/i18n/locales/{pt,en,fr}.json`: 3 chaves novas — `agenda.details.reassignArtist`, `agenda.details.reassignConfirm`, `agenda.details.reassignSuccess`.

## Arquivos tocados

- `src/lib/ghl.ts` — helper `updateAppointmentEvent`
- `src/lib/appointments.functions.ts` — server fn `reassignAppointmentArtist`
- `src/components/agenda-appointment-sheet.tsx` — `ArtistPicker` + fio da mutação
- `src/i18n/locales/pt.json`, `en.json`, `fr.json` — chaves i18n

## Perguntas antes de implementar

1. **Escopo de permissão:** confirma que só admin pode reatribuir? (Ou artista também pode "passar" um cliente para outro artista?) sim artista tambem podi
2. **Comissão ao reatribuir:** mantém o `commission_pct` congelado no registro (mais simples, menos surpresa) ou recalcula com base no novo artista? Recomendo manter congelado no MVP.  
deixar o mesmo valor