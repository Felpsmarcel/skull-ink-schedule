# Dar acesso à plataforma para Vendedores

Hoje `sellers` é só um cadastro para atribuir vendas em appointments. Vou transformar cada vendedor em um usuário da plataforma (login por email), com um escopo próprio de leitura/escrita.

## 1. Banco de dados (migração única)

- Adicionar valor `'seller'` ao enum `public.user_role`.
- Adicionar coluna `seller_id uuid references public.sellers(id)` em `public.app_users` (nullable, unique parcial para 1 user ↔ 1 seller).
- Nova função `public.current_seller_id()` (STABLE SECURITY DEFINER) análoga a `current_artist_id()`.
- Ajustar policies:
  - `appointments SELECT`: permitir `current_user_role() = 'seller' AND seller_id = current_seller_id()` (somente leitura).
  - `appointments INSERT`: manter admin livre; permitir seller se `seller_id = current_seller_id()`.
  - `appointment_services SELECT`: idem via join.
  - `payments SELECT`: seller enxerga pagamentos dos appointments dele.
  - `sellers SELECT`: seller enxerga o próprio registro.
- Atualizar `get_monthly_report` e `get_my_artist_appointments`:
  - Aceitar `seller` como novo caminho: quando `current_user_role() = 'seller'`, filtrar por `a.seller_id = current_seller_id()`.
  - Nova RPC `get_my_seller_appointments()` espelhando `get_my_artist_appointments()` (sem revelar `commission_pct` do artista; expondo apenas comissão do vendedor).

## 2. Backend (server functions)

- `src/lib/auth.functions.ts`: incluir `seller` em `AppRole` e `sellerId` no `MyProfile`.
- `src/lib/team.functions.ts` continua só para artistas. Novo `src/lib/sellers-invite.functions.ts` com:
  - `inviteSeller({ sellerId, email })` — reaproveita o fluxo `inviteArtist` (auth admin invite, insert em `app_users` com `role='seller'` e `seller_id`), com template dedicado ou reaproveitando `team-welcome`.
  - `repairSellerLink({ sellerId, email })`.
- Ajustar `listSellers` para admin retornar também `users: [{ id, email }]` (join simplificado com `app_users`), igual a `listTeam`.

## 3. UI

- **`admin.vendedores.tsx`**: adicionar cards estilo `admin.equipe.tsx` — badge "vinculado/sem usuário", campo de email, botões "Convidar" / "Reenviar" chamando `inviteSeller`.
- **Menu / roles**: `menu.tsx` mostra "Vendedor" quando `role === 'seller'`; itens visíveis:
  - Agenda (somente leitura)
  - Novo agendamento
  - Meu financeiro
  - Relatório mensal (filtrado)
- **`AuthShell` topbar + `BottomNav`**: mesmos itens do artista; esconder ações admin.
- **Agenda (`agenda.tsx`)**: quando role=seller, chips não abrem sheet de edição — apenas visualização (usar sheet em modo readonly já existente ou desabilitar botões de status/finalizar).
- **Fluxo `/appointments/new`**:
  - Se `role === 'seller'`, pré-seleciona `sellerId = me.sellerId` e trava o seletor de vendedor (readonly).
  - Envia normalmente pelo `createAppointment` server fn (RLS garante `seller_id`).
- **Financeiro (`financeiro.tsx`) e Relatório (`relatorios.agendamentos.tsx`)**:
  - Detectar `role='seller'`, chamar as RPCs com filtro por `seller_id`.
  - Exibir apenas comissão do vendedor (`sellers.commission_pct` sobre `total_eur`), ocultando comissão do artista.

## 4. Guardas de rota

- Criar `src/routes/_authenticated/_seller/route.tsx` análogo a `_admin` para gate quando necessário (ex.: bloquear rotas de admin). Alternativa mais simples: filtro no `menu.tsx`/`AuthShell` + redirecionamentos em `_admin` já existentes cobrem o essencial.

## Detalhes técnicos

- Enum: `ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'seller';` (fora de transação — migração dedicada só para o enum antes das demais).
- Grants: `GRANT SELECT ON public.sellers TO authenticated` já existe; garantir `GRANT EXECUTE ON FUNCTION public.current_seller_id() TO authenticated`.
- Backwards compat: sellers sem `app_users` linkado continuam funcionando como hoje (apenas cadastro).
- Convite reaproveita `inviteArtist` via helper compartilhado (`inviteUserWithRole({ email, role, linkColumn, linkValue })`) para evitar duplicação.

## Fora do escopo

- Editar/cancelar agendamentos pelo vendedor (fica somente leitura).
- Vendedor ver appointments de outros vendedores.
- Notificações push/email extras além do convite inicial.
