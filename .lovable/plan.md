## Plano: Navegação autenticada padronizada

### Componente único `AuthShell`
Novo `src/components/layout/auth-shell.tsx` renderizado no layout `_authenticated/route.tsx`. Centraliza chrome de navegação; substitui o `BottomNav` atual e o `UserMenu` espalhado.

- **Itens base (ambos roles)**: Agenda (`/agenda`), Novo (`/appointments/new`, FAB destacado), Financeiro (`/financeiro`), Perfil (`/menu`).
- **Itens admin-only** (via `useIsAdmin()`): Reconciliar (`/reconciliar`) — aparece só no header desktop e dentro de `/menu`; **não** vira tab principal para evitar tab vazia para artista.
- **Itens removidos da nav principal**: Serviços e Avaliações (placeholders/admin-only) — Serviços permanece acessível via `/menu` para admin; Avaliações fica acessível só via `/menu` enquanto não houver feature real.
- **Sair**: continua no `/menu`; remover do dropdown UserMenu (UserMenu inteiro deixa de ser usado nos headers).

### Layout responsivo

**Mobile (`< sm`)**: bottom nav fixo no shell, idêntico ao atual mas com 4 itens funcionais (Agenda · Novo (FAB) · Financeiro · Perfil). Destaque via `Link activeProps` (`data-status="active"` → cor primária + linha superior).

**Desktop/tablet (`>= sm`)**: top bar fino no shell com logo + links horizontais + (se admin) link Reconciliar + botão Sair. Bottom nav escondido (`sm:hidden`). Top bar escondida em mobile (`hidden sm:flex`).

### Quando esconder o chrome
O shell calcula `hideChrome` a partir do pathname (via `useRouterState`). Esconde nav em fluxos full-screen:
- `/appointments/new` e sub-rotas (fluxo multi-step com headers próprios).

Páginas tab (agenda, financeiro, services, reviews, menu, reconciliar, ghl-test) recebem o chrome. Tab atual é detectada via `Link activeProps` por rota — sem prop `active` manual.

### Edições por arquivo

- **`src/routes/_authenticated/route.tsx`**: envolver `<Outlet />` em `<AuthShell>` que renderiza TopBar (desktop) + main + BottomNav (mobile) condicionalmente. Sem mexer em auth.
- **`src/components/layout/auth-shell.tsx`** (novo): shell + cálculo de `hideChrome` + role-gated items.
- **`src/components/layout/bottom-nav.tsx`**: refator para 4 itens (Agenda, Novo, Financeiro, Perfil); remover prop `active` (usar `activeProps` do Link).
- **`src/routes/_authenticated/agenda.tsx`**: remover `<BottomNav active="agenda" />` e `<UserMenu />` do header. Ajustar `pb-20` se necessário (mantém porque shell mantém bottom nav fixo).
- **`src/routes/_authenticated/financeiro.tsx`**: remover `<UserMenu />`; manter botões admin (Sincronizar, atalho Reconciliar) — são ações de página, não de nav.
- **`src/routes/_authenticated/services.tsx`**, **`reviews.tsx`**, **`menu.tsx`**: remover `<BottomNav ... />` (shell cuida).
- **`src/components/auth/user-menu.tsx`**: deletar arquivo (não usado mais). Sair vive no `/menu` (já existe lá).
- **i18n**: adicionar/ajustar `nav.financeiro` e `nav.profile` em pt/en/fr; remover não usados (`nav.services`, `nav.reviews`) só se não usados em outro lugar — confirmar antes; se ainda referenciados em `/menu`, manter.

### Fora de escopo
- Mudar autenticação, permissões server-side, RLS, GHL, migrations.
- Criar rotas novas (Perfil reusa `/menu`).
- Sidebar complexa desktop.
- Refatorar headers internos das páginas (back button, título, ações de página continuam).

### Critérios de aceite
1. Rota ativa destacada no mobile e desktop via `activeProps`.
2. 4 tabs mobile, todas levam a rota real.
3. Desktop mostra header horizontal consistente em todas as telas autenticadas (exceto fluxo `/appointments/new`).
4. Artista não vê link Reconciliar; admin vê.
5. Nada de "Em breve" como ação principal de nav.
6. Auth/RLS intactos; `/reconciliar` continua protegido pelo `_admin` layout.