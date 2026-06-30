## Objetivo
Tornar status visualmente legíveis sem mexer no design system global.

## 1. Novo componente `src/components/ui/status-badge.tsx`
- Props: `variant: "success" | "warning" | "danger" | "info" | "neutral"`, `children`, `className?`, opcional `icon?`.
- Implementação: wrapper sobre o `Badge` do shadcn (variant `outline`) com classes Tailwind por variante, mantendo fundo claro + texto/borda coloridos para bom contraste no tema B/W:
  - success → `bg-emerald-50 text-emerald-700 border-emerald-200`
  - warning → `bg-amber-50 text-amber-800 border-amber-200`
  - danger  → `bg-red-50 text-red-700 border-red-200`
  - info    → `bg-sky-50 text-sky-700 border-sky-200`
  - neutral → `bg-muted text-muted-foreground border-border`
- Tamanho compacto (`text-xs px-2 py-0.5 rounded-md font-medium`) consistente com badges atuais.
- Sem alterações em `styles.css` nem em tokens globais (cores Tailwind built-in, escopadas ao componente).

## 2. Helper de mapeamento de bucket
No mesmo arquivo, exportar:
```ts
export function bucketToVariant(b: "pago" | "pendente" | "a_receber"): Variant
// pago → success, pendente → warning, a_receber → info
```
e `bucketLabel(b)` reutilizando os textos já mostrados hoje (sem tocar na lógica em `finance.functions.ts`).

## 3. `src/routes/_authenticated/financeiro.tsx`
Substituir os 4 pontos que hoje renderizam `{r.bucket}` cru (linhas ~268, ~306, ~355, ~412 — cards mobile e tabelas admin/artista) por `<StatusBadge variant={bucketToVariant(r.bucket)}>{bucketLabel(r.bucket)}</StatusBadge>`. Nenhuma mudança em filtros, cálculos ou estrutura de layout.

## 4. `src/routes/_authenticated/_admin/reconciliar.tsx`
Cada card de falha aberta recebe um `<StatusBadge variant="warning">Pendente</StatusBadge>` no header (ao lado do título), e quando o usuário marca como resolvido via mutation otimista podemos exibir `<StatusBadge variant="success">Resolvido</StatusBadge>` temporariamente antes do refetch. Sem mudar `sync.functions.ts` nem fluxos de resolução.

## 5. Agenda
Avaliado: os blocos hoje usam apenas livre/ocupado em preto/branco, sem semântica de status colorível pedida no contexto. **Não aplicar** nesta tarefa para respeitar a restrição de não refatorar visual global. (Se quiser depois, podemos colorir conflitos/erros do proxy.)

## Fora de escopo
- `styles.css`, tokens, tema, dark mode.
- Lógica de bucket, server functions, migrations, GHL.
- Refatorar outros badges do app.

## Critérios de aceite
- StatusBadge importável e usado nos 3 locais acima.
- Financeiro mostra pílulas coloridas para pago/pendente/a receber em mobile e desktop.
- Reconciliar mostra pílula warning por card aberto.
- Layout mobile inalterado (badge é inline e compacto).
- Contraste AA nas combinações escolhidas.
