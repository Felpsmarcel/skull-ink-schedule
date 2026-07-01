## Problema

`src/routes/auth.tsx` renderiza o formulário de login diretamente e não tem `<Outlet />`. Como os arquivos `auth.reset.tsx` e `auth.update-password.tsx` usam a convenção de pontos, o TanStack Router os trata como **filhos** da rota `/auth`. Resultado: ao abrir `/auth/reset` ou `/auth/update-password`, o router casa a rota filha, mas o pai (`auth.tsx`) monta o login e nunca renderiza o filho. As telas ficam invisíveis.

Observação: o commit foi referido como `/auth/recover`, mas o arquivo real é `auth.reset.tsx` e o link em `auth.tsx` aponta para `/auth/reset`. Vou manter `/auth/reset` (o que já está em uso) para não quebrar o link existente.

## Correção

Usar a convenção de **underscore final** do TanStack para desanichar as rotas filhas do layout `/auth`, sem transformar `auth.tsx` em layout (o que exigiria refatorar o login para dentro de um `auth.index.tsx`).

### Passos

1. Renomear via `mv`:
  - `src/routes/auth.reset.tsx` → `src/routes/auth_.reset.tsx`
  - `src/routes/auth.update-password.tsx` → `src/routes/auth_.update-password.tsx`
   O `auth_` (com underscore final) quebra a herança de layout: as URLs continuam `/auth/reset` e `/auth/update-password`, mas o TanStack não as monta mais dentro de `auth.tsx`.
2. Atualizar o `createFileRoute(...)` de cada arquivo renomeado para o novo id gerado:
  - `createFileRoute("/auth/reset")` → `createFileRoute("/auth_/reset")`
  - `createFileRoute("/auth/update-password")` → `createFileRoute("/auth_/update-password")`
3. Ajustar o link "Esqueci minha senha" em `src/routes/auth.tsx` para `<Link to="/auth_/reset">` (a URL pública renderizada continua `/auth/reset`, mas o `to` tipado usa o id do router).
4. Ajustar `redirectTo` no `resetPasswordForEmail` para `${window.location.origin}/auth/update-password` (já está, apenas confirmar após rename).
5. `src/routeTree.gen.ts` é regenerado automaticamente pelo plugin — não editar.

### Critério de aceite

- `/auth` mostra o login.
- `/auth/reset` mostra o formulário de recuperação (form independente, sem overlay do login).
- `/auth/update-password` mostra o formulário de nova senha para o link do email de convite/recovery.
- Nenhuma rota sobrepõe a outra e o link "Esqueci minha senha" navega corretamente.

## Fora do escopo desta correção

Sua mensagem cita mais 4 blocos (onboarding real, convite Supabase, cron GHL com `x-cron-secret`, testabilidade), mas só o problema **#1 (rotas /auth/*)** veio detalhado. Confirme se quer que eu continue com os itens 2–5 no próximo plano ou cole os detalhes deles para eu incluir agora.  
segue o prompt completo.  
# Correção crítica do commit MVP-1 — onboarding, recuperação de senha e cron GHL

Você deve corrigir o último commit relacionado a:

- Team management / onboarding de artistas

- Recuperação de senha

- Update password para usuários convidados

- Cron/sync GHL com `x-cron-secret`

## Contexto

O último commit adicionou:

- `src/lib/team.functions.ts`

- `src/routes/_authenticated/_admin/equipe.tsx`

- `src/routes/auth.recover.tsx`

- `src/routes/auth.update-password.tsx`

- alterações em `src/routes/auth.tsx`

- alterações em `src/routes/api/public/hooks/sync-ghl.ts`

- migration `supabase/migrations/20260701090000_setup_ghl_sync_cron.sql`

Mas a revisão crítica encontrou problemas bloqueadores. Corrija sem reescrever histórico publicado. Faça novos commits normais.

---

## Objetivo

Deixar a Sprint MVP-1 realmente funcional e segura para MVP:

1. Onboarding real de artista

2. Recuperação de senha funcionando

3. Convite Supabase funcionando para artista definir senha

4. Sync GHL agendável com segurança

5. Rotas corretas e testáveis

---

## Problemas a corrigir

### 1. Rotas `/auth/recover` e `/auth/update-password` provavelmente não renderizam

Hoje elas foram criadas como filhas de `/auth`, mas `src/routes/auth.tsx` não renderiza `<Outlet />`.

Corrigir a arquitetura de rotas de uma das formas abaixo:

- opção preferida: transformar `/auth` em layout que renderiza `<Outlet />` quando estiver em rota filha;

- ou mover as rotas para uma estrutura que não dependa de `<Outlet />`;

- ou consolidar recovery/update em modos da própria rota `/auth`, se for mais simples.

Critério de aceite:

- acessar `/auth` mostra login;

- acessar `/auth/recover` mostra tela de recuperação;

- acessar `/auth/update-password` mostra tela de nova senha;

- uma rota não sobrepõe a outra.

---

### 2. Corrigir callback real de Supabase invite/recovery

A rota `/auth/update-password` hoje só chama:

```ts

supabase.auth.updateUser({ password })