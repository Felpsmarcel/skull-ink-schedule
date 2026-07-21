
## Objetivo

Dar visibilidade permanente ao link pessoal `/movimentacao/<slug>` para tatuadores e vendedores **já ativos**, sem depender de e-mail ou onboarding. Hoje o único acesso in-app é uma linha discreta no Menu ("Registrar pagamento"), sem indicação de que existe um link compartilhável nem opção de copiar.

## Estado atual (verificado)

- `src/routes/_authenticated/menu.tsx` — item "Registrar pagamento" apontando para `/movimentacao` como linha padrão, sem destaque.
- `src/routes/_authenticated/movimentacao.index.tsx` — chama `getMySlug()` e redireciona ao slug; se `slug === null`, mostra "Sem link de registro".
- Já existe `getMySlug` em `src/lib/movimentacao.functions.ts` retornando `{ slug: string | null }`.
- Não há nenhum componente hoje que mostre o link `https://…/movimentacao/<slug>` ou permita copiá-lo.

## Escopo (do que o usuário aprovou)

Somente tatuadores/vendedores **já ativos** — sem alterar e-mail de convite nem telas de onboarding.

## Entregas

### 1. Novo componente `PaymentLinkCard`
`src/components/movimentacao/payment-link-card.tsx`

- Usa `useQuery` com `getMySlug` (mesma queryKey `["my-movimentacao-slug"]` já usada em `movimentacao.index.tsx` para reaproveitar cache).
- Só renderiza se `data.slug` existir. Retorna `null` para admin sem slug e para qualquer usuário sem vínculo — nada de placeholder.
- Layout mobile-first: card com borda destacada, ícone `Banknote`, título "Seu link de pagamento", subtítulo com a URL curta (`gftattoocalendar.com/movimentacao/<slug>`), e dois botões:
  - **Copiar** (`navigator.clipboard.writeText`, toast "Link copiado").
  - **Abrir** (`Link` do TanStack para `/movimentacao/$slug`).
- URL base: `https://gftattoocalendar.com` (custom domain de produção — hardcoded como já é feito em `team.functions.ts`).

### 2. Inserir card no Menu
`src/routes/_authenticated/menu.tsx`

- Colocar `<PaymentLinkCard />` logo acima da seção "Conta" (fica em destaque, acima do avatar/e-mail? Não — abaixo do bloco de perfil, antes de "Conta", para ficar acima da linha atual "Registrar pagamento").
- Manter a linha "Registrar pagamento" na seção "Conta" (atalho continua útil e é fallback quando o card não renderiza).

### 3. Inserir card na Agenda (mobile)
`src/routes/_authenticated/agenda.tsx`

- Renderizar `<PaymentLinkCard />` em um único lugar visível apenas no mobile: dentro do drawer/menu lateral existente **ou**, se não houver drawer adequado, como um bloco colapsável abaixo do header. **Decisão:** durante a implementação, ler `agenda.tsx` e escolher o local que não empurre a grade do dia para baixo (preferência: dentro do menu lateral / sheet, não fixo no topo).
- Se não existir slot mobile-friendly sem impactar a densidade da agenda, restringir a exposição ao Menu apenas e documentar isso no PR — melhor cortar escopo do que degradar a Agenda.

### 4. Nada de novo backend
Reusa `getMySlug`. Sem migração, sem RLS, sem edge function.

## Fora de escopo

- E-mail `team-welcome.tsx`.
- Card em `/onboarding/pronto`.
- QR code (pode virar follow-up).
- Notificação push / toast recorrente.

## Detalhes técnicos

- URL final: `https://gftattoocalendar.com/movimentacao/${slug}` (produção). Em `import.meta.env.DEV`, usar `window.location.origin` para o link copiado funcionar em dev.
- Copiar: `try { await navigator.clipboard.writeText(url); toast.success("Link copiado") } catch { toast.error("Não foi possível copiar") }` — fallback textual não é necessário porque o app é PWA HTTPS.
- Acessibilidade: botão "Copiar" com `aria-label="Copiar link de pagamento"`.
- Não alterar estilo global; usar tokens existentes (`border-primary/40 bg-primary/5` ou similar, seguindo padrão dos cards atuais).

## Passos de implementação

1. Criar `src/components/movimentacao/payment-link-card.tsx`.
2. Inserir em `menu.tsx` acima da seção "Conta".
3. Ler `agenda.tsx`, escolher slot mobile e inserir; se não houver bom slot, pular passo 3 e informar.
4. Verificar tsgo/build.
5. Smoke test manual via preview: como artista com slug, ver card; como admin sem slug, não ver.
