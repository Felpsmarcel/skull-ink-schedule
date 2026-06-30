## Bloqueio #1 — Artista não consegue gravar appointment no Supabase

### Causa raiz

`public.appointments` tem hoje 3 policies:

| Policy | Cmd | Quem | Efeito |
|---|---|---|---|
| `appt_admin` | ALL | `current_user_role() = 'admin'` | admin faz tudo |
| `appt_artist_select_blocked` | SELECT | só admin | artista lê via função `get_my_artist_appointments` (SECURITY DEFINER) |
| `appt_artist_update` | UPDATE | artista do próprio `artist_id` | só UPDATE |

Não existe policy de **INSERT** para `artist`. Quando o tatuador logado clica em "Finalizar", `finalizeAppointment()` cria o evento no GHL com sucesso e em seguida tenta `supabase.from("appointments").insert(...)` com o token dele. O insert é barrado por RLS → erro propaga, mas o evento já existe no GHL → **dessincronia permanente**.

### Alternativas consideradas

**A. Adicionar policy `INSERT` para `artist`**
- `WITH CHECK (current_user_role() = 'artist' AND artist_id = current_artist_id())`
- Simples, mantém escrita client-side, sem nova superfície de servidor.
- Contra: amplia o que o cliente pode escrever diretamente em `appointments` (campos como `total_eur`, `commission_pct`, `services`). Mesmo com check de `artist_id`, o tatuador poderia forjar valores. Hoje isso não é blindado por nenhum trigger.

**B. Mover a escrita para uma server function `SECURITY DEFINER`**
- `finalizeAppointment` vira `createServerFn` com `requireSupabaseAuth`, autoriza o caller (admin OU artist dono do `artist_id`), e usa `supabaseAdmin` para o insert.
- Vantagem: o servidor é a fonte de verdade dos campos sensíveis (`total_eur`, `commission_pct`, `original_eur`, `services`). Cliente só manda intent + contato + slot.
- Vantagem: cria o evento no GHL e o registro no banco no mesmo handler — facilita compensação se o insert falhar.
- Contra: refactor maior; mexe em `src/lib/appointments.ts`, no checkout e no index do fluxo.

**C. Trigger BEFORE INSERT que valida `artist_id = current_artist_id()` + policy A**
- Mistura A com defesa em profundidade.
- Não resolve o problema de o cliente poder inflar `total_eur` (a comissão do artista é calculada sobre esse valor — incentivo direto a manipular).

### Solução escolhida: **B — server function + SECURITY DEFINER**

Por quê:
- A comissão do artista (`get_my_artist_appointments`) usa `total_eur * commission_pct / 100`. Permitir que o próprio artista escreva esses campos do navegador é um furo de negócio, não só de RLS.
- Já temos a infraestrutura: `requireSupabaseAuth`, `attachSupabaseAuth` em `src/start.ts`, padrão consolidado em `src/lib/finance.functions.ts`.
- Mantém GHL como source-of-truth do evento e Supabase como espelho consistente, escrito por código confiável.

### Mudanças propostas

**1. Migration (RLS)**
- Manter `appt_admin` como está.
- Manter `appt_artist_update` (artista ainda pode editar status/notas do próprio appointment via futuras telas).
- **Não** adicionar policy de INSERT para artista. Insert continua bloqueado para client; só o service role escreve.
- Revogar `INSERT` direto de `authenticated` (defesa em profundidade), garantindo que o caminho oficial seja a server fn.

**2. Nova server fn `createAppointmentRecord` em `src/lib/appointments.functions.ts`**
- `.middleware([requireSupabaseAuth])`
- Input validado (Zod): `{ artistId, calendarId, locationId, contactId, contactName?, contactPhone?, contactEmail?, startISO, endISO, title, notes?, status?, services: [{ id, discountPct }] }`. **Não** aceita `total_eur` nem `commission_pct` do cliente.
- Autorização: `role = admin` OU (`role = artist` AND `artistId === current_artist_id()`). Caso contrário, 403.
- Recalcula `total_eur`, `original_eur`, `final_eur` por linha a partir de `public.services` (server-side, fonte de verdade dos preços) usando o `discountPct` informado.
- `commission_pct` lido de `public.artists` (default 40 se nulo).
- Cria o evento no GHL (chamando o proxy igual hoje).
- Insere em `public.appointments` via `supabaseAdmin`.
- Se o insert falhar após o evento GHL ser criado: tenta deletar o evento no GHL para compensar; se a deleção falhar, retorna erro estruturado com `ghlEventId` para reconciliação manual e loga.

**3. Refactor de `src/lib/appointments.ts`**
- `finalizeAppointment` passa a ser um wrapper fino que chama a server fn via `useServerFn` (ou export direto para uso fora de componente).
- Remove a chamada direta a `createAppointment` e ao `supabase.from("appointments").insert` no cliente.

**4. Call sites**
- `src/routes/_authenticated/appointments.new.checkout.tsx` e `appointments.new.index.tsx`: continuam chamando `finalizeAppointment(draft)`; assinatura externa muda só para refletir que `totalEur/commissionPct` não são mais necessários no input (são derivados no servidor). Resultado segue `{ ghlEventId, appointmentId }`.

**5. Validação**
- Playwright: logar como `gabriel@gftattoo.test`, completar o fluxo de novo agendamento, finalizar, e verificar:
  - resposta 200 da server fn,
  - `appointments` no banco com `artist_id = Gabriel`, `total_eur` correto,
  - evento aparece em `getEvents` do GHL.
- Repetir como `admin@gftattoo.test` para garantir não-regressão.
- Teste negativo: chamar a server fn com `artistId` diferente do `current_artist_id()` do artista → esperar 403, sem evento criado.

### Impacto arquitetural

- Cliente perde a capacidade de gravar em `appointments` diretamente — passa a ser via server fn. Coerente com o que já fizemos em finanças.
- `total_eur` e `commission_pct` deixam de ser confiáveis a partir do cliente — passam a ser autoridade do servidor.
- Nada muda para admin no curto prazo (continua vendo tudo).

### Risco de regressão

- **Médio-baixo**. O ponto de chamada está concentrado em `finalizeAppointment`. Risco principal é a compensação GHL↔DB: se o insert no banco falhar e o delete no GHL também falhar, fica um evento órfão no GHL — mitigado por log + retorno do `ghlEventId` para a UI mostrar aviso.
- Tabelas/RLS de outras telas não são tocadas.
- Sem mudança de schema (colunas).

### O que NÃO entra neste plano

- Não toco em `artist_id` nullability, FK para `auth.users`, nem em `appointments.contact_id` (FK para `contacts` Supabase).
- Não migro o search de contato do GHL.
- Não implemento backfill / cron GHL → Supabase (continua Sprint 3).
- Não mexo em finanças, agenda, ou outras rotas.

Aprovado para implementar?
