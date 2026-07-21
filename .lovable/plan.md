## Problema

`src/components/movimentacao/payment-link-card.tsx` lê `window.location.origin` no corpo do componente:

```ts
const origin = import.meta.env.DEV ? window.location.origin : PROD_ORIGIN;
```

Isso executa durante o render inicial. No servidor/prerender do TanStack Start, `window` não existe → `ReferenceError` que derruba a árvore de `/onboarding/bem-vindo` (e qualquer rota onde o card seja incluído no futuro). É por isso que o app parece "quebrado" e o link não abre.

## Correção

Ajustar somente `src/components/movimentacao/payment-link-card.tsx`:

1. Trocar o cálculo de `origin` por um valor seguro:
   - Sempre usar `PROD_ORIGIN` como base.
   - Se `typeof window !== "undefined"` e o hostname atual for `localhost` ou `id-preview--*.lovable.app`, usar `window.location.origin` (para permitir testar em preview sem quebrar produção).
   - Fazer isso dentro de `useMemo` executado só no cliente, ou via `useEffect` + `useState`, garantindo que o primeiro render seja SSR-safe.
2. Manter comportamento visual e o botão "Copiar" idênticos.

## Verificação

- Recarregar `/onboarding/bem-vindo` e confirmar que a tela renderiza sem tela branca.
- Confirmar que o card só aparece quando há slug e que o botão "Abrir" navega para `/movimentacao/<slug>`.
- Confirmar que "Copiar" copia a URL correta (`https://gftattoocalendar.com/movimentacao/<slug>` em produção).
