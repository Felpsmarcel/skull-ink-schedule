# Link de pagamento + status no /admin/vendedores

## Objetivo
No painel `/admin/vendedores`, cada card de vendedor passa a mostrar:
- O link público de registro de pagamento correspondente ao vendedor (ex.: `https://www.gftattoocalendar.com/movimentacao/nivia`), com botão de copiar.
- O status do vínculo da conta de usuário (linkada ou não), com o email vinculado quando existir.

Interpretei "link do tatuador correspondente" como o link individual de movimentação do próprio vendedor — o mesmo padrão já usado em `/admin/movimentacao-links`. Se você quiser algo diferente, me avisa antes.

## O que já existe (não mexer)
- `SellerCard` já mostra badge "vinculado / sem usuário" e lista os emails vinculados.
- `src/config/movimentacao-slugs.ts` já define o slug `nivia` (kind `seller`, `sellerId`).
- `src/routes/_authenticated/_admin/admin.movimentacao-links.tsx` já tem o padrão de copiar link com `PROD_ORIGIN = "https://www.gftattoocalendar.com"`.

## Alterações

### `src/routes/_authenticated/_admin/admin.vendedores.tsx`
- Dentro do `SellerCard`, procurar em `MOVIMENTACAO_SLUGS` um alvo com `kind === "seller"` e `sellerId === seller.id`.
- Se encontrar: renderizar bloco com:
  - Rótulo "Link de pagamento".
  - Campo readonly (Input) com a URL `${PROD_ORIGIN}/movimentacao/<slug>`.
  - Botão "Copiar" (ícone `Copy`) usando `navigator.clipboard.writeText` + `toast.success`.
- Se não encontrar: pequeno aviso `text-[11px] text-muted-foreground` "Sem slug de link configurado em `movimentacao-slugs.ts`."
- Reforçar o badge de status já existente ("vinculado" verde / "sem usuário" amarelo) — sem mudança de lógica, só garantir posicionamento consistente próximo ao bloco do link.

### Constante compartilhada
- Extrair `PROD_ORIGIN` para `src/config/movimentacao-slugs.ts` (novo export) e importar tanto em `admin.movimentacao-links.tsx` quanto em `admin.vendedores.tsx`, evitando duplicação.

## Fora de escopo
- Não altero lógica de convite, reparar vínculo ou criação/edição de vendedor.
- Não crio slugs novos automaticamente — se um vendedor não tiver slug em `movimentacao-slugs.ts`, apenas exibo o aviso.
- Não mexo em `/admin/movimentacao-links` (já tem a mesma função para artistas + Nivia).
