
## Objetivo
No `agenda`, clicar num slot livre deve abrir `/appointments/new` com `calendarId` (do tatuador da coluna) e `startISO` (horário do slot) já preenchidos no draft local. Sem chamadas ao GHL, sem criar nada.

## Mudanças

### 1. `SlotCell` recebe `calendarId`
`src/routes/_authenticated/agenda.tsx`
- `StaffColumn` já tem `agenda.staff.calendarId`. Passar para cada `SlotCell`:
  ```tsx
  <SlotCell key={slot.startMs} slot={slot} calendarId={staff.calendarId} />
  ```
- Assinatura: `function SlotCell({ slot, calendarId }: { slot: GridSlot; calendarId: string })`.

### 2. Handler de clique no slot livre
Substituir o `onClick={() => toast(t("actions.comingSoon"))}` do branch `status === "free"` por:
```tsx
const navigate = useNavigate();
const draft = useAppointmentDraft();
...
onClick={() => {
  draft.reset();                                 // garante estado limpo
  draft.setCalendar(calendarId);
  draft.setStart(new Date(slot.startMs).toISOString());
  navigate({ to: "/appointments/new" });
}}
```
- Import: `useNavigate` de `@tanstack/react-router`, `useAppointmentDraft` de `@/stores/appointment-draft`.
- Verificar que `appointment-draft` expõe `reset`, `setCalendar`, `setStart` (já usado em `appointments.new.index.tsx`); se `reset` não existir, adicionar uma ação no store que zera `contact`, `services`, `discount`, `notes`, mantendo apenas o que o handler vai setar.

### 3. Compatibilidade com perfis
- Artista restrito: só vê sua própria coluna → o `calendarId` enviado é o dele; nada a alterar.
- Admin: vê todas as colunas → o handler usa o `calendarId` da coluna clicada, então o draft já abre com o tatuador certo pré-selecionado em `appointments.new.index.tsx` (que respeita `draft.calendarId`).

### 4. Pré-seleção sobrevive no destino
`appointments.new.index.tsx` hoje só aplica o default ao primeiro artista quando `draft.calendarId` é null. Como agora chegará preenchido, o `select` de tatuador e o picker de horário devem refletir os valores. Verificar que o picker de slot livre marca o `startISO` recebido como `active` quando o slot bater com um dos `getFreeSlots` do dia — não há mudança de código necessária, mas a validação inclui esse caso.

## Fora do escopo
- Slots `booked` continuam não-clicáveis.
- Slots `outside` continuam vazios.
- Sem alteração em GHL, finalização, i18n, ou store além do `reset()` (se faltar).

## Validação
1. Build/typecheck.
2. Playwright (admin logado):
   - `/agenda`, screenshot.
   - Clicar num botão "Sem reserva" de uma coluna, confirmar `page.url` = `/appointments/new`.
   - Inspecionar `localStorage` do store Zustand: `calendarId` e `startISO` populados.
   - Screenshot da tela `/appointments/new` mostrando o tatuador correto selecionado e o slot destacado.
3. Repetir como artista restrito: clicar no slot da própria coluna → mesma navegação, draft com seu `calendarId`.
