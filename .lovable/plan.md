## Situação atual

O comando `tsgo` reporta 9 erros TypeScript hard que impedem o build limpo. Sem build limpo, não é seguro publicar nem testar o dashboard editável recém-criado.

## Objetivo deste plano

Restaurar o build zero-erros corrigindo apenas os problemas de tipo introduzidos nas rotas de autenticação e na agenda.

## Erros identificados

1. **Rotas `/auth` exigem `search` obrigatório** — `validateSearch` em `/auth` provavelmente define `redirect` como obrigatório ou o tipo inferiu `search` required. Isso quebra `navigate({ to: "/auth", replace: true })` em:
   - `src/components/layout/auth-shell.tsx`
   - `src/routes/_authenticated/menu.tsx`
   - `src/routes/index.tsx`

2. **Links para `/auth_/recover` inválidos** — a rota real é `/auth/recover` (underscore no nome de arquivo vira segmento normal). Arquivos afetados:
   - `src/routes/auth.tsx`
   - `src/routes/auth_.recover.tsx`
   - `src/routes/auth_.update-password.tsx`

3. **Links para `/auth` sem `search` em `auth_.recover.tsx`** — mesma causa do item 1.

4. **Tipo `debug` inferido como `boolean` em vez de `true`** — em `src/routes/_authenticated/agenda.tsx`, a função reducer de `navigate({ search: (prev) => ... })` permite `debug: false`, mas o schema de busca deve aceitar `boolean`.

## Passos de implementação

### 1. Ajustar schema de busca de `/auth`

Tornar `redirect` opcional explicitamente no `validateSearch` de `src/routes/auth.tsx` para que `search` não seja required nos tipos do router.

### 2. Corrigir todos os `navigate`/`Link` para `/auth`

Adicionar `search: { redirect: undefined }` (ou omitir de forma compatível) nas chamadas em:
- `auth-shell.tsx`
- `menu.tsx`
- `index.tsx`

Se o schema ficar realmente opcional, as chamadas atuais passam a compilar sem alteração.

### 3. Corrigir links `/auth_/recover` → `/auth/recover`

Atualizar todos os `<Link to="/auth_/recover" ... />` e `navigate({ to: "/auth_/recover" })` para `/auth/recover`.

### 4. Corrigir reducer de search em `agenda.tsx`

Alterar a tipagem ou o schema de busca da rota `/agenda` para que `debug` seja `boolean` em vez de `true`, permitindo que o reducer preserve o valor anterior sem erro de contravariância.

### 5. Reexecutar `tsgo` e iterar

Após as correções, rodar `bunx tsgo` novamente para confirmar zero erros. Se surgirem novos erros de tipo derivados dessas mudanças, corrigi-los no mesmo ciclo.

## Fora do escopo deste plano

- Novas funcionalidades no dashboard editável.
- Refatorações de UX/UI.
- Ajustes na migration de soft-delete (já criada, pendente de deploy).

## Resultado esperado

`bunx tsgo` finaliza com `0 errors`, permitindo publicar e testar o app com segurança.