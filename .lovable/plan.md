# Vendedores no sistema

Adicionar o papel "Vendedor" (Leonardo, Juliane, Nívia, Felipe Fernandes) ao sistema. Toda venda de tatuagem pode ter um vendedor associado, com comissão em % fixa por vendedor, aparecendo no Financeiro.

## Escopo

- **Cadastro** de vendedores (nome, % de comissão, ativo) — gerenciado apenas pelo admin.
- **Seleção** de vendedor no momento de criar o agendamento e também no sheet de um agendamento existente. Admin e tatuador podem escolher.
- **Financeiro**: mostrar o vendedor e a comissão dele em cada linha, e somar o total de comissão de vendedores.
- **Semente inicial**: 4 vendedores com 0% (admin ajusta depois).

Fora de escopo: login para vendedor, split automático de pagamento, relatório dedicado por vendedor (fica para depois).

## Modelo de dados

Nova tabela `public.sellers`:

- `name` (text, único)
- `commission_pct` (numeric, default 0, 0–100)
- `active` (boolean, default true)

Coluna nova em `public.appointments`:

- `seller_id` (uuid null, FK `sellers.id` ON DELETE SET NULL)

Regras de acesso:
- `sellers`: SELECT para `authenticated` (todos precisam listar no dropdown); INSERT/UPDATE/DELETE só para admin (via `current_user_role()`).
- `appointments.seller_id`: já coberto pelas policies existentes de appointments.

Comissão do vendedor por agendamento é calculada em tempo real:
`seller_commission_eur = round(total_eur * sellers.commission_pct / 100, 2)`
(não persistimos — segue a % atual do cadastro, igual ao padrão já usado em `commission_pct` do tatuador via `get_monthly_report`).

## Backend (server functions)

Novo arquivo `src/lib/sellers.functions.ts`:

- `listSellers()` — todos autenticados; retorna ativos (com opção de incluir inativos para admin).
- `createSeller({ name, commission_pct })` — admin.
- `updateSeller({ id, name?, commission_pct?, active? })` — admin.
- `deleteSeller({ id })` — admin (soft: seta active=false; não apaga se houver appointments referenciando).

Ajustes em `src/lib/appointments.functions.ts`:

- Server fn existente de criação de agendamento passa a aceitar `seller_id` opcional.
- Nova `setAppointmentSeller({ ghlAppointmentId, seller_id | null })` (mesmo padrão de `setAppointmentPaymentStatus`, com checagem admin/artista).
- `getAppointmentFinanceByGhlId` retorna `seller: { id, name, commission_pct, commission_eur }` quando houver.

Ajustes em `src/lib/agenda-status.functions.ts` e `finance.functions.ts` para trazer `seller_id`, `seller_name` e `seller_commission_eur` nas listagens que alimentam Agenda e Financeiro.

## UI

**Novo: admin > Vendedores** (`src/routes/_authenticated/_admin/admin.vendedores.tsx`)
- Tabela simples com nome, % comissão, ativo, ações (editar/desativar).
- Botão "Novo vendedor".
- Link no menu admin ao lado de "Equipe".

**Novo agendamento** (`appointments.new.checkout.tsx` ou passo apropriado)
- Campo `<Select>` "Vendedor" (opcional, com "Nenhum").

**Sheet do agendamento** (`agenda-appointment-sheet.tsx`, seção Financeiro)
- `<Select>` "Vendedor" abaixo do status manual. Chama `setAppointmentSeller` via `useServerFn`, invalida caches de agenda/financeiro.
- Quando houver vendedor, mostra "Comissão vendedor: € X,XX (Y%)".

**Financeiro** (`src/routes/_authenticated/financeiro.tsx`)
- Nova coluna "Vendedor" (nome ou "—").
- Nova coluna "Comissão vend." (€).
- Totalizador no rodapé soma a comissão de vendedores do período filtrado.
- (Sem filtro por vendedor nesta iteração — pode entrar em fase 2 se quiser.)

## Migração

Uma migration cria `sellers` com GRANTs + RLS + policies, adiciona `seller_id` em `appointments`, e insere os 4 vendedores iniciais com `commission_pct = 0`.

## Arquivos a criar/editar

- criar: `supabase/migrations/<timestamp>_sellers.sql`
- criar: `src/lib/sellers.functions.ts`
- criar: `src/routes/_authenticated/_admin/admin.vendedores.tsx`
- editar: `src/lib/appointments.functions.ts`, `src/lib/finance.functions.ts`, `src/lib/agenda-status.functions.ts`
- editar: `src/components/agenda-appointment-sheet.tsx`
- editar: fluxo `appointments.new.*` (passo de checkout)
- editar: `src/routes/_authenticated/financeiro.tsx`
- editar: menu admin para incluir link "Vendedores"

## Perguntas antes de aprovar

1. Confirma **0% inicial** para todos os 4 (você ajusta depois no admin)? Ou já quer definir os %?
2. Comissão do vendedor **entra como despesa/dedução no total do estúdio** no Financeiro, ou é só informativa (não afeta nenhum outro cálculo hoje)?
