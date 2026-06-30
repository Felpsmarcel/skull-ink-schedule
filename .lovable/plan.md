## Mudanças de texto (somente i18n + meta title)

### `src/i18n/locales/pt.json`
- `appt.checkout`: `"Checkout"` → `"Revisar agendamento"`
- `appt.checkoutTitle`: `"Detalhe / Checkout"` → `"Revisar agendamento"`
- `appt.finalize`: `"Finalizar"` → `"Confirmar agendamento"`
- `appt.payNow`: mantida no JSON (não é renderizada em nenhum lugar hoje — já removida da UI em iteração anterior); nenhuma ação.

### `src/i18n/locales/en.json`
- `appt.checkout`: `"Checkout"` → `"Review appointment"`
- `appt.checkoutTitle`: `"Detail / Checkout"` → `"Review appointment"`
- `appt.finalize`: → `"Confirm appointment"`

### `src/i18n/locales/fr.json`
- `appt.checkout`: `"Checkout"` → `"Vérifier le rendez-vous"`
- `appt.checkoutTitle`: `"Détail / Checkout"` → `"Vérifier le rendez-vous"`
- `appt.finalize`: → `"Confirmer le rendez-vous"`

### `src/routes/_authenticated/appointments.new.checkout.tsx`
- Apenas o `<title>` hardcoded na linha 23: `"Checkout — GF Tattoo Studio"` → `"Revisar agendamento — GF Tattoo Studio"`.
- Nenhuma outra alteração (rota, componente, lógica intactos).

### Fora do escopo (não tocar)
- Nome do arquivo `appointments.new.checkout.tsx` e rota `/appointments/new/checkout`.
- Lógica de criação, server functions, GHL, Supabase, migrations.
- `appointments.new.index.tsx` não tem texto hardcoded relevante (já usa `t()` via `validateAppointmentDraft`); nenhuma edição.

### Critérios de aceite verificáveis
1. Header do step de revisão exibe "Revisar agendamento".
2. Botão final exibe "Confirmar agendamento" (quando `canCheckout` é true).
3. Navegar de `/appointments/new` → `/appointments/new/checkout` continua funcionando (rota inalterada).
4. EN/FR mostram as traduções equivalentes ao trocar o idioma.
