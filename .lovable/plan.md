
## Objetivo

Adicionar, na tela `/onboarding/bem-vindo`, um card explicando o formulário de pagamento e exibindo o slug pessoal do usuário com botão de copiar o link completo.

## Estado atual (verificado)

- `src/routes/_authenticated/onboarding.bem-vindo.tsx` renderiza uma lista de 3 cards ("Sua agenda", "Comissões", "Lembretes automáticos") acima do botão "Começar".
- Já existe `PaymentLinkCard` em `src/components/movimentacao/payment-link-card.tsx` que:
  - lê `getMySlug()` via `useQuery`,
  - retorna `null` se não houver slug,
  - mostra a URL, botão Copiar e botão Abrir.

## Entrega

Reutilizar `PaymentLinkCard` diretamente em `onboarding.bem-vindo.tsx`.

- Inserir `<PaymentLinkCard />` **abaixo dos 3 cards informativos** e **acima do botão "Começar"**.
- Como o componente retorna `null` sem slug, admins/usuários sem vínculo não veem nada — sem branch extra.
- Nenhuma mudança no componente em si (título "Seu link de pagamento", botão Copiar + Abrir já atendem ao pedido).

## Fora de escopo

- Alterar textos dos outros passos do onboarding.
- Criar variante "informativa" do card (título/tom diferente para primeira vez). O card atual já é claro; se depois quiser um texto mais explicativo específico para o onboarding, faço num follow-up.

## Passos

1. Editar `src/routes/_authenticated/onboarding.bem-vindo.tsx`: importar `PaymentLinkCard` e inseri-lo entre o `<ul>` e o `<Button>`.
2. Verificar build.
