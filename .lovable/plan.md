## Problema

Na tela **Revisar agendamento** (`/appointments/new/checkout`), o botão **"Confirmar agendamento"** não conclui a operação. Nos logs de rede recentes não há nenhuma requisição para `createAppointmentRecord` nem para o endpoint `/calendars/events/appointments` do GHL — ou seja, o clique não chega a disparar o `run()`, ou ele aborta silenciosamente antes do POST.

Estado atual verificado:
- O usuário logado é **admin**, então `useArtists()` retorna dados.
- O rascunho em `sessionStorage` tem contato, `calendarId`, `startISO`, serviços — `canFinalize` deveria ser `true`.
- Nenhum erro de console foi capturado no snapshot atual.

Suspeitas mais prováveis (a validar):
1. Alguma validação em `useFinalizeAppointment` está retornando cedo e o `toast.error` não aparece (i18n ausente ou `toast` fora de contexto).
2. `useArtists` está temporariamente vazio no momento do render → `staff` = null → botão desabilitado ou `validateAppointmentDraft` retorna `noCalendar`.
3. `startISO` no rascunho está em formato inválido (`endISO = NaN`) e o POST falha na serialização.

## Plano de correção

### 1. Reproduzir e capturar sinal (Playwright)
- Abrir `/appointments/new/checkout` autenticado, clicar em **Confirmar agendamento** e coletar:
  - `console.error` / `console.warn`
  - Requisições `POST /_serverFn/*` (payload + resposta)
  - Toasts renderizados
- Screenshot antes/depois do clique.

### 2. Instrumentar o fluxo
Em `src/hooks/use-finalize-appointment.ts`:
- Adicionar `console.info("[finalize] start", {...})` no início de `run()`.
- Logar o resultado de `validateAppointmentDraft` (com o `reason` quando inválido).
- Envolver `finalizeAppointment(...)` em `try/catch` que loga o erro completo (`console.error("[finalize] failed", e)`) além do toast.

Em `src/routes/_authenticated/appointments.new.checkout.tsx`:
- Trocar `onClick={() => void run()}` por um handler nomeado com `try/catch` que loga a intenção de clique — assim descartamos definitivamente "o clique não chega".
- Se `!canFinalize`, o botão hoje fica desabilitado silenciosamente: exibir um `toast.info` ou uma linha discreta indicando o campo faltante quando o usuário clica.

### 3. Aplicar a correção
Depois de identificar a causa raiz com o log/repro:
- **Se for `useArtists` vazio no render**: usar `isLoading` do hook para exibir `<Loader2 />` no botão até os artistas carregarem, evitando `staff = null` transitório.
- **Se for `startISO` inválido**: sanear no `setStart` do `appointment-draft` store, e revalidar no cliente antes de chamar o server fn.
- **Se for erro do server fn (GHL/DB)**: propagar `e.message` no toast (já feito) e revisar o retorno do server fn para incluir `code`/`step` explícito.

### 4. Validação
- Playwright cria um agendamento real ponta-a-ponta com um contato/serviço de teste.
- Confirmar em `public.appointments` (SELECT via `supabase--read_query`) que o registro apareceu com `total_eur` e `commission_pct`.
- Confirmar no toast: "Agendamento criado · 1080,00 €".

## Notas técnicas
- Não alterar `appointments.functions.ts` sem sinal — ele já compensa GHL vs DB.
- Não introduzir novos endpoints; usar o server fn existente `createAppointmentRecord`.
- Manter i18n: qualquer nova string entra em `pt.json` / `fr.json` / `en.json`.
