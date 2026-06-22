## Migração 3 — Seed serviços + ajustes de UI

### Migration: schema + seed (uma migration só)

1. `ALTER TABLE services ADD COLUMN IF NOT EXISTS price_max_eur numeric(8,2)` 
2. `ALTER TABLE services ADD COLUMN IF NOT EXISTS description_short text`
3. `TRUNCATE services RESTART IDENTITY CASCADE` (garante seed limpo — services hoje pode ter linhas antigas; CASCADE limpa `appointment_services` que está vazio)
4. `INSERT` dos 24 serviços nas 6 categorias, exatamente como você colou

### Código

**`src/lib/services.ts`** — adicionar ao tipo `Service`:
- `price_max_eur: number | null`
- `description_short: string | null`

E ajustar `fetchActiveServices` para incluir as duas colunas no SELECT.

**`src/routes/appointments.new.services.tsx`**:
- Agrupar serviços por `category` (accordion ou seções com header)
- Exibir `description_short` em cinza abaixo do nome
- Preço: se `price_max_eur && price_max_eur !== price_eur` → `"a partir de €{price_eur}"` ou `"€{price_eur} – €{price_max_eur}"`; senão `"€{price_eur}"`
- Ordenar por `sort_order`

**`src/stores/appointment-draft.ts`** + **`/checkout`**:
- `totalOriginalEur` continua somando `price_eur` (mínimo da faixa) — é o valor "âncora" do agendamento. `price_max_eur` é só informativo na seleção, não entra no total.
- Sem mudança de lógica de desconto.

### Fora de escopo
- Permitir o usuário escolher um valor dentro da faixa no checkout (hoje fixa no mínimo). Se quiser isso, me avisa que adiciono um input "valor acordado" na tela de serviços ou checkout.

### Como testar
1. Aprovar migration → ver 24 linhas em `services` (6 categorias × 4)
2. Ir em `/appointments/new` → escolher tatuador e data
3. `/appointments/new/services` → ver as 6 categorias agrupadas, descrição curta, preço com faixa quando aplicável
4. Selecionar 1+ serviços → `/appointments/new/checkout` → confirmar total = soma dos `price_eur` mínimos
5. "Salvar" → criar no GHL → conferir no calendário do tatuador
