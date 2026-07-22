## Objetivo

Permitir que quem preenche o formulário de `/movimentacao/$slug` escolha **quem recebeu o pagamento** (staff fixo) e **quem é o tatuador** (lista de artistas), separadamente. O slug passa a ser apenas uma pré-seleção do "Recebido por" — tudo continua editável.

## O que muda para o utilizador

No formulário público de pagamento:

```text
Recebido por *   [ Gabriel ▾ ]   ← pré-selecionado pelo slug, editável
Tatuador *       [ Selecione ▾ ] ← lista de artistas ativos (como hoje)
```

O card cinza "Recebido por: Gabriel Fernandes" (read-only) some — vira um `Select`.

## Passos

**1. Definir o staff fixo em `src/config/movimentacao-slugs.ts`**

Adicionar uma lista canônica de quem pode receber pagamento, cada item apontando para o `app_user_id` real no banco (o que hoje é resolvido dinamicamente por `resolveSlugOwner`):

```ts
export type StaffRecebedorId = "gabriel" | "nivia" | "augusto" | "felipe";

export interface StaffRecebedor {
  id: StaffRecebedorId;
  displayName: string;
  appUserId: string;   // FK real em app_users(id)
}

export const STAFF_RECEBEDORES: StaffRecebedor[] = [...];
```

Preencho os `appUserId` reais consultando o banco antes de escrever o migration/config (Gabriel = ffmconsultoria, Nivia = conta do seller, Augusto = araujoaugusto499, Felipe = a decidir se existe conta ativa).

Também adiciono `slug → StaffRecebedorId` como default:

```ts
export const SLUG_DEFAULT_RECEBEDOR: Record<MovimentacaoSlug, StaffRecebedorId> = {
  gabriel: "gabriel", andre: "gabriel", joyce: "gabriel",
  augusto: "augusto", nivia: "nivia",
};
```

(Andre e Joyce hoje resolvem para a conta do Gabriel; mantenho esse comportamento como default, mas editável.)

**2. `src/lib/movimentacao.functions.ts`**

- `SlugContext` ganha `recebedores: StaffRecebedor[]` e `defaultRecebedorId: StaffRecebedorId`. Continuo devolvendo `recebidoPorNome` para o cabeçalho, mas ele passa a refletir o default.
- `resolveSlugOwner(slug)` é substituído/complementado por uma resolução baseada em `STAFF_RECEBEDORES` — sem lookup dinâmico por `artist_id`/`seller_id`. Isso também remove o bug "Nenhuma conta linkada".
- `CreateInput` do `createMovimentacao` ganha `recebido_por_id: z.enum([...ids])`. O handler traduz para `recebido_por_app_user_id` via `STAFF_RECEBEDORES`, em vez de derivar do slug.
- `link_origem` continua sendo o `slug` (tracking de origem preservado).
- GHL sync: `recebido_por_nome` passa a vir do staff escolhido, não do dono do slug.

**3. `src/components/movimentacao/movimentacao-form.tsx`**

- Substituir o card read-only "Recebido por" por um `Select` obrigatório, inicializado com `context.defaultRecebedorId`.
- Adicionar `recebido_por_id` ao `FormState` e enviar no `submit`.
- O cabeçalho da página (`movimentacao.$slug.tsx`) passa a mostrar o nome do recebedor atualmente selecionado (via callback opcional) ou simplesmente "Registro de pagamento" sem subtítulo.

**4. Reprocess (admin)**

`reprocessFailedMovimentacoes` lê `recebido_por_app_user_id` da linha existente (não mais do slug), então não precisa mais do `resolveSlugOwner` — só de um lookup em `app_users` para o `displayName` na hora do sync. Simplifica a função.

## Detalhes técnicos

- Compatibilidade: linhas antigas em `movimentacoes` já têm `recebido_por_app_user_id` correto — nada a migrar.
- Segurança: `createMovimentacao` continua público (rota `/movimentacao/$slug`), mas o `recebido_por_id` é validado contra a lista fechada `STAFF_RECEBEDORES` (Zod enum), então não dá para forjar UUID arbitrário.
- Verificação antes de escrever o config: rodar `SELECT id, email FROM app_users WHERE email IN (...)` para confirmar os 4 `appUserId`. Se o Felipe não tiver conta ativa, ele fica fora da lista (a decisão anterior foi apagar o `app_user` dele) — nesse caso o staff fica 3 pessoas (Gabriel, Nivia, Augusto).
- Nenhum migration SQL é necessário.

## Arquivos afetados

- `src/config/movimentacao-slugs.ts` (adicionar STAFF_RECEBEDORES + defaults)
- `src/lib/movimentacao.functions.ts` (SlugContext, createMovimentacao, reprocess)
- `src/components/movimentacao/movimentacao-form.tsx` (novo Select)
- `src/routes/movimentacao.$slug.tsx` (ajuste de cabeçalho)