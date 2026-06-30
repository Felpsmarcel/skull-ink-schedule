## Mudanças

### 1. `src/routes/_authenticated/appointments.new.index.tsx`
- Logo abaixo do header, antes do `<main>`, adicionar uma **checklist horizontal compacta** com 4 pílulas: Cliente, Tatuador, Horário, Serviço. Cada pílula mostra um ícone `CheckCircle2` (preenchido = `text-primary`) ou `Circle` (pendente = `text-muted-foreground`) + label curta. Layout `flex gap-2 overflow-x-auto` para caber no mobile sem overflow horizontal da página.
- Usar `validateAppointmentDraft(draft, artists)` (já existente) como **única fonte de verdade** para derivar:
  - `completed = { contact, staff, start, service }` (booleans, calculados a partir do draft sem repetir lógica).
  - `firstPending`: a primeira `reason` do validator (`noContact` → `noCalendar`/`noStaff` → `noStart` → `noServices`).
- Substituir o **footer atual** (3 botões: ghost "⋯", outline "Checkout", primary "Checkout" — visivelmente duplicado) por **um único botão primary full-width**:
  - Texto dinâmico via `firstPending` → "Selecione um cliente" / "Escolha um tatuador" / "Escolha um horário" / "Adicione um serviço".
  - Quando válido → "Revisar agendamento" + total à direita; ao clicar, `navigate({ to: "/appointments/new/checkout" })`.
  - `disabled` quando há pendência (texto explicativo já no próprio botão; o botão fica desabilitado para não parecer quebrado, mas a checklist no topo mostra exatamente o que falta).
- Reaproveitar `formatPrice(totalFinalEur(draft))` para o total.

### 2. i18n — `src/i18n/locales/{pt,en,fr}.json`
Adicionar sob `common.appt`:
```
"checklist": { "client": "...", "staff": "...", "time": "...", "service": "..." },
"cta": {
  "selectClient": "Selecione um cliente" | "Pick a client" | "Choisir un client",
  "selectStaff":  "Escolha um tatuador" | "Pick an artist" | "Choisir un tatoueur",
  "selectTime":   "Escolha um horário" | "Pick a time"    | "Choisir un créneau",
  "addService":   "Adicione um serviço"| "Add a service"  | "Ajouter un service",
  "review":       "Revisar agendamento"| "Review booking" | "Vérifier le rendez-vous"
}
```
Manter as chaves existentes intactas.

### 3. Fora de escopo
- Sem mudanças em `appointment-draft-validate.ts`, store, rotas, server functions, GHL, Supabase, migrations.
- Não criar agendamento aqui.
- Comportamento das outras telas (services, checkout) intocado.

## Validação
- Typecheck.
- Mobile (390x844) via Playwright: abrir `/appointments/new`, conferir checklist com 4 pílulas e texto do CTA mudando ao preencher cada campo. Sem overflow horizontal.
