## Plano confirmado (versão corrigida)

Duas mudanças na Day View da Agenda, com correções da autocrítica.

### 1. `src/lib/agenda-grid.ts` — enriquecer `GridSlot`

Adicionar campos por slot booked:
- `eventStartMs`, `eventEndMs` (snapped em múltiplos de 30 min)
- `spanSlots` (nº de slots de 30 min que o evento cobre)
- `isFirstSlot` (só o primeiro slot renderiza o cartão)
- `hasOverlap` (2+ eventos concorrentes no mesmo calendário)
- `contactId`, `appointmentStatus` (para o Sheet)

Em `buildDayGrid`, trocar `evRanges.find` por `filter` para detectar sobreposição.

### 2. `src/routes/_authenticated/agenda.tsx` — cartão único absoluto

No `SlotCell` (booked):
- Se `!isFirstSlot` → renderiza spacer invisível `h-14` (mantém alinhamento com coluna de horas).
- Se `isFirstSlot` → wrapper `relative` e cartão **absolutamente posicionado** com `height: spanSlots*56 - 4px`, `left/right: 2px`. Cartão é `<button>` focável (a11y) que mostra:
  - cliente (bold)
  - serviço (muted)
  - `HH:mm – HH:mm` (novo — hora de fim visível)
  - `StatusBadge` de pagamento
  - ⚠ ícone se `hasOverlap`

`StaffColumn` passa `agenda.staff` inteiro para o `SlotCell` (não só o `calendarId`) para o Sheet ter o nome do tatuador.

### 3. Novo: `src/components/agenda-appointment-sheet.tsx`

Sheet lateral (right no desktop, mesmo Sheet no mobile — o componente shadcn já é responsivo). Recebe:

```ts
{ open, onOpenChange, slot, staffName }
```

Conteúdo:
- Cliente + `StatusBadge` de pagamento
- `Ter, 01 jul · 14:30 – 16:30 · 2 h`
- Tatuador
- Serviço
- Contato (via `useQuery(["ghl-contact", contactId], () => getContact(contactId))`, `enabled: !!contactId && open`, `staleTime: 5min`):
  - Telefone com `<a href="tel:">` + botão Copiar
  - E-mail com `<a href="mailto:">` + botão Copiar
  - Se 403/erro → `ErrorState` compacto (resto do painel continua útil)
- Status GHL (`appointmentStatus`) se presente
- Bloco Debug (só com `?debug=1`): event id, calendar id, contact id

Usa `Sheet`, `SheetContent side="right" className="w-full sm:max-w-md"`, `LoadingState`, `ErrorState`, `StatusBadge` já existentes.

### 4. i18n (PT/EN/FR) — chaves novas em `common.agenda.details`

`title`, `duration`, `artist`, `service`, `contact`, `phone`, `email`, `copy`, `copied`, `call`, `sendEmail`, `notes`, `noContact`, `contactError`, `overlap`, `close`.

## Fora de escopo (não muda)

- Week / Month views permanecem como estão.
- Editar / cancelar / reagendar.
- Backend, RLS, migrations.

## Riscos residuais aceitos

- Overlap: primeiro evento vence no cartão principal; badge ⚠ + Sheet mostra que há sobreposição (não lista os outros nesta iteração — se virar comum, próximo ciclo).
- `getContact` pode 403 para artistas — Sheet degrada com `ErrorState` na seção de contato.
