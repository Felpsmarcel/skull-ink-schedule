# Autenticação e separação de perfis

## Estado atual (verificado)
- `app_users` está **vazia** (zero usuários cadastrados).
- Enum `user_role` tem **`admin`** e **`artist`** (não "tatuador").
- Funções `current_user_role()`, `current_artist_id()`, `has_role()` já existem.
- `artists` tem os 4 tatuadores (Andre, Gabriel, Maciel, Neto).
- Nenhuma rota usa auth hoje. `__root.tsx` não tem provider de sessão.

## Usuários de teste a criar (via seed)
| Papel | Email | Senha | Vínculo |
|---|---|---|---|
| admin | `admin@gftattoo.test` | `Admin#2026` | — |
| artist | `gabriel@gftattoo.test` | `Artist#2026` | Gabriel Fernandes |

Criados via `auth.admin.createUser` em uma server function de seed que roda uma vez, depois inserindo em `app_users` com `role` e `artist_id`. Senhas podem ser trocadas no primeiro login (fora do escopo agora).

## Arquivos a criar

1. **`src/routes/auth.tsx`** — pública. Form email+senha → `supabase.auth.signInWithPassword`. Após sucesso, lê `?redirect=` e navega; default `/agenda`. Se já logado, redireciona direto.

2. **`src/routes/_authenticated/route.tsx`** — layout protegido, `ssr: false`, `beforeLoad` chama `supabase.auth.getUser()`, redireciona para `/auth?redirect=…` se não houver sessão. Renderiza `<Outlet />`.

3. **`src/routes/_authenticated/_admin/route.tsx`** — layout admin-only. `beforeLoad` chama server fn `requireAdmin` (usa `has_role(auth.uid(),'admin')`). Redireciona para `/agenda` se não admin.

4. **`src/lib/auth.functions.ts`** — server functions:
   - `getMyProfile` (`requireSupabaseAuth`): retorna `{ userId, role, artistId }` lendo `app_users`.
   - `requireAdmin` (`requireSupabaseAuth`): throw redirect se não admin.

5. **`src/hooks/use-current-user.ts`** — `useQuery` chamando `getMyProfile`, cacheado.

6. **`src/components/auth/user-menu.tsx`** — avatar + nome do papel + botão Logout (`supabase.auth.signOut()` + `queryClient.clear()` + `navigate('/auth', replace)`).

7. **`src/integrations/supabase/auth-attacher.ts`** — verificar existência (já listado no projeto); registrar em `src/start.ts` como `functionMiddleware` se ainda não estiver.

## Arquivos a mover/atualizar

- **Mover** `src/routes/agenda.tsx` → `src/routes/_authenticated/agenda.tsx`.
- **Mover** `src/routes/appointments.new*.tsx` → `src/routes/_authenticated/appointments.new*.tsx`.
- **Mover** `src/routes/ghl-test.tsx` → `src/routes/_authenticated/_admin/ghl-test.tsx`.
- **`src/routes/index.tsx`** — redireciona para `/agenda` se logado, senão para `/auth`.
- **`src/routes/__root.tsx`** — adicionar `onAuthStateChange` único que faz `router.invalidate()` em SIGNED_IN/OUT/USER_UPDATED e `queryClient.invalidateQueries()` exceto em SIGNED_OUT (padrão documentado).
- **`src/hooks/use-agenda.ts`** — aceitar lista de artistas já filtrada. Não filtrar aqui.
- **`src/routes/_authenticated/agenda.tsx`** — usar `useCurrentUser()`; se `role==='artist'`, passa apenas o staff cujo `id === artistId` para `useStaffDayAgenda`. Se admin, passa todos. Renderiza `<UserMenu />` no header.

## Proteção de dados (defesa em profundidade)

A filtragem no frontend impede ver a agenda dos outros na UI, mas o GHL não conhece perfis. Para garantir que **um tatuador autenticado não consiga puxar a agenda de outro nem via URL/fetch direto**, o `ghl-proxy` precisa validar:

- **`supabase/functions/ghl-proxy/index.ts`** — atualizar para:
  1. Exigir JWT do Supabase (já vem no header `Authorization` quando chamado via `supabase.functions.invoke`).
  2. Resolver `userId` → ler `app_users` (role, artist_id) via service role.
  3. Se `role === 'artist'`: validar que qualquer `calendarId` em `path`/`query` pertence ao `artist_id` do usuário (consulta `artists.ghl_calendar_id`). Bloquear caso contrário com 403.
  4. Admin passa livre.

  Isso fecha o buraco de um tatuador autenticado tentar `ghlFetch` com outro `calendarId`.

## Cron de seed (uma única vez)

Em vez de cron, faço o seed via `supabase--insert` chamando uma SQL que invoca `auth.admin.create_user` não está disponível por SQL puro. Alternativa: criar uma server route pública `/api/public/hooks/seed-test-users` protegida por header secret (gerado com `generate_secret`), você chama uma vez via `curl`/preview e nunca mais. Devolve credenciais no log. Após uso, remover a rota.

> Mais simples ainda: aproveitar `supabase--insert` para inserir direto em `auth.users` é proibido (schema gerenciado). Vou usar a server-route de seed acima.

## Fora de escopo (não vou tocar agora)
- Tela de signup pública (admin cria contas).
- Reset de senha (pode ser feito depois com `/reset-password`).
- Dashboard financeiro (rota admin existirá mas vazia, placeholder).
- Sync GHL→Supabase (assunto separado).

## Resposta direta à sua pergunta
**Não, `app_users` não tem nenhum usuário.** Vou criar os dois acima (admin + Gabriel como tatuador-teste) durante a implementação e te devolvo as credenciais no chat após rodar o seed.
