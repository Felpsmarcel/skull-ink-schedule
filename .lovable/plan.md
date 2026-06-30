## Objetivo

Remover botões "Em breve" sem função real da agenda e do checkout para reduzir a sensação de app quebrado.

## Mudanças

### 1. `src/routes/_authenticated/agenda.tsx`
- Remover os dois `IconBtn` do header (Chat e Notificações) que só disparam `toast("Em breve")`.
- Remover imports não usados após a limpeza: `MessageCircle`, `Bell`, `toast`, e o componente `IconBtn` (e o `NavItem` legado já não usado).
- Manter `UserMenu`, navegação de data, calendário e grid intactos.

### 2. `src/components/layout/bottom-nav.tsx`
- Manter apenas **Agenda** (esquerda), botão central **Novo** (FAB) e **Menu** (direita).
- Remover **Serviços** e **Avaliações** do bottom nav.
  - Justificativa: `/services` é funcional (CRUD real) e `/menu` é funcional (financeiro, sair, etc.), então ambos ficam. `/reviews` é placeholder "Em breve", então sai da nav.
  - Serviços continua acessível via `/services` direto (rota não removida — restrição do escopo). Avaliações idem.
- Ajustar grid para 3 itens em vez de 5; garantir que o FAB central continua proeminente.
- Atualizar tipo `BottomNavTab` para `"agenda" | "menu"` (drop "services" e "reviews"). As páginas `/services`, `/reviews`, `/menu` deixam de marcar `active` para abas removidas — Services e Reviews passam a renderizar `BottomNav` com `active="menu"` (chegada via Menu) ou sem destaque; uso `active="menu"` em ambas para evitar quebra de tipos.

### 3. `src/routes/_authenticated/appointments.new.checkout.tsx`
- Remover o botão "Pagar agora" do footer (não há pagamento implementado e o handler era só `toast("Em breve")`).
- Footer passa a ter apenas **Finalizar** ocupando toda a largura.
- Remover import `toast` se ficar sem uso.

### 4. i18n
- Não precisa adicionar chaves. Apenas, opcionalmente, remover `common.actions.comingSoon` se ficar órfão.
- Verificação: `common.actions.comingSoon` ainda é usada em `src/routes/_authenticated/menu.tsx` (DisabledRow) e possivelmente em outros lugares fora do escopo — **manter a chave** nos três locales.

## Fora de escopo (não tocar)

- Comportamento dos slots livres.
- Rotas `/services`, `/reviews`, `/menu` continuam existindo.
- Migrations, Supabase, GHL, server functions, schema.
- Lógica de finalização.

## Validação

- Typecheck.
- Playwright em viewport 390x844 (mobile):
  - `/agenda` logado: header sem Chat/Notificações; bottom nav com 3 itens (Agenda · Novo · Menu); sem overflow horizontal.
  - `/appointments/new/checkout`: footer só com "Finalizar".
  - Sem botão visível que dispare "Em breve" nessas duas telas.
