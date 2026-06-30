
## Problema

Os 3 botões SERVIÇOS, AVALIAÇÕES e MENU da tab bar em `src/routes/_authenticated/agenda.tsx` chamam `toast(t("actions.comingSoon"))` — só mostram um aviso. Apenas AGENDA e o "+" central têm comportamento real.

## Plano

### 1. Refatorar a tab bar (parar de duplicar)
Extrair a `<nav>` (linhas 234–247 de `agenda.tsx`) para `src/components/layout/bottom-nav.tsx` recebendo a aba ativa. Usar `<Link to=...>` em vez de `onClick + navigate` para preload e cmd-click. Aceitar `active: "agenda" | "services" | "reviews" | "menu"`. Reutilizar nas novas rotas.

### 2. Rota `/services` — catálogo + CRUD (admin)
Arquivo: `src/routes/_authenticated/services.tsx`.
- **Todos os perfis**: lista os 24 serviços já existentes em `public.services`, agrupados por categoria, com nome, faixa de preço, duração estimada e badge de status ativo/inativo.
- **Admin only** (`useCurrentUser().role === "admin"`):
  - Botão "Novo serviço" no header → abre `<Sheet>` com form (name, category, description, price_min, price_max, duration_min, active).
  - Cada card ganha menu kebab com "Editar" e "Desativar/Ativar".
  - Artistas só veem a lista (sem botões de ação).
- Mutations via `createServerFn` (`src/lib/services.functions.ts`) com `requireSupabaseAuth` + check `has_role('admin')`. Não criamos endpoints públicos para isso.
- Invalidação: `queryClient.invalidateQueries({ queryKey: ["services"] })` após cada mutation.

**Banco**: o schema atual de `public.services` já cobre os campos necessários. Verificar que existe policy de UPDATE/INSERT/DELETE para admin (hoje só há SELECT pública); se faltar, migração curta adicionando policies `services_admin_write` usando `has_role(auth.uid(), 'admin')`. Mantém a SELECT pública para a tela de seleção de serviço no checkout.

### 3. Rota `/reviews` — placeholder estruturado
Arquivo: `src/routes/_authenticated/reviews.tsx`.
- Header "Avaliações" + tab bar inferior com `active="reviews"`.
- Empty state honesto: ícone Star, título "Em breve", parágrafo explicando que a coleta de reviews via GHL/Google ainda não está integrada. Sem dados fake, sem rota de API, sem tabela nova.

### 4. Rota `/menu` — perfil + atalhos + sair
Arquivo: `src/routes/_authenticated/menu.tsx`.
- Header "Menu" + tab bar com `active="menu"`.
- Card de perfil no topo: avatar circular com iniciais, nome do usuário (`app_users.name`), e-mail, badge da role (Admin/Artist).
- Lista de atalhos com ícones e chevron à direita, usando `<Link>`:
  - **Todos**: "Meu financeiro" → `/financeiro`.
  - **Admin only**: "Reconciliar GHL" → `/reconciliar`, "Testar GHL" → `/ghl-test`.
- Bloco de configurações (não funcionais ainda, marcados como em breve): "Notificações", "Idioma".
- Botão "Sair" no rodapé chamando `supabase.auth.signOut()` + `navigate({ to: "/auth" })`.

### 5. Atualizar `agenda.tsx`
Remover a `<nav>` inline; importar e usar `<BottomNav active="agenda" />`. O botão "+" central continua dentro do componente (não muda).

### 6. i18n
Adicionar chaves novas em `src/i18n/locales/{pt,fr,en}.json` (se houver): `nav.menu.profile`, `nav.menu.finance`, `nav.menu.reconcile`, `nav.menu.signOut`, `nav.services.new`, `nav.services.edit`, `nav.services.deactivate`, `nav.reviews.emptyTitle`, `nav.reviews.emptyBody`. Sem strings hard-coded.

## Detalhes técnicos

- **Acesso a rotas**: tudo fica sob `_authenticated/`, então o guard atual basta. A separação admin/artist é apenas visual + validada nas server fns (defense-in-depth).
- **Server fns**: `createService`, `updateService`, `toggleServiceActive` em `src/lib/services.functions.ts` (cliente-safe path). Cada uma valida com Zod e checa `has_role('admin')`; falha = `Response('Forbidden', { status: 403 })`. `supabaseAdmin` é importado dinamicamente dentro do handler.
- **Hook**: `useServices()` já existe (`src/hooks/use-services.ts` ou similar) — reutilizar, garantindo invalidate keys consistentes.
- **Tab bar ativa**: comparação por prop `active`, não por `pathname` (evita falsos positivos em rotas filhas como `/services/new`).
- **Sem mudança no fluxo de novo agendamento**: o "+" continua indo para `/appointments/new`, e `/appointments/new/services` segue sendo o passo do wizard (sem conflito com a nova `/services` standalone).

## Fora de escopo

- Coleta real de reviews (Google/GHL).
- Configurações de notificação e idioma funcionais.
- Edição de perfil/avatar.
- CRUD de serviços para não-admin.
