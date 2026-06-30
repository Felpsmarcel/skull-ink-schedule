## Plano: Componentes padronizados de Empty/Error/Loading

### Novos componentes (UI puros, sem deps novas)

**`src/components/ui/empty-state.tsx`**
```tsx
type Props = { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string };
```
Layout centralizado vertical, ícone em círculo `bg-muted`, título `text-sm font-medium`, descrição `text-xs text-muted-foreground`, action abaixo. Padding `py-10`.

**`src/components/ui/error-state.tsx`**
```tsx
type Props = { title?: string; description?: string; details?: string; onRetry?: () => void; retryLabel?: string; className?: string };
```
- `title` default: "Algo deu errado" (i18n `common.error.title`).
- `description` curta e amigável.
- `details` (mensagem técnica) escondida em `<details><summary>Detalhes técnicos</summary><pre>…</pre></details>` — não exibida como mensagem principal, mas continua acessível.
- Botão "Tentar novamente" (ícone RefreshCw) quando `onRetry` definido.
- Ícone `AlertTriangle` em destaque sutil (`text-destructive`).

**`src/components/ui/loading-state.tsx`**
```tsx
type Props = { label?: string; size?: "sm" | "md"; inline?: boolean; className?: string };
```
- `Loader2 animate-spin` + label curta (default `common.loading` = "Carregando…").
- `inline` para uso em linha (flex row pequeno); padrão é bloco centralizado `py-8`.

Sem novas dependências (usa `lucide-react`, `cn`, tokens existentes).

### Aplicação inicial (sem mudar lógica de dados)

**`agenda.tsx`** (linhas ~267-291)
- Bloco de error com `slots.length === 0`: trocar Alert/pre por `<ErrorState description={t("agenda.errorLoading")} details={error} onRetry={() => agenda.refetch?.()} />` (manter retry existente se houver; senão sem retry).
- Painel debug (`<pre>{error}</pre>`) permanece intacto.

**`financeiro.tsx`**
- Loading principal (linha ~165, `isLoading`): `<LoadingState />`.
- Error block: `<ErrorState description="Não foi possível carregar o financeiro." details={(error as Error).message} onRetry={() => refetchSummary()} />` (se hook expõe refetch; senão sem onRetry).
- Empty rows dentro de tabela/cards: manter texto existente OU trocar célula de "sem dados" por `<EmptyState title={emptyMsg} />` apenas nos containers fora de `<tr>` (cards mobile). Linha de tabela continua com `<tr><td>{emptyMsg}</td></tr>` para não quebrar markup.

**`appointments.new.index.tsx`**
- Slots loading (linha 258) → `<LoadingState inline label={t("appt.loadingSlots")} size="sm" />`.
- Slots error (linha 261) → `<ErrorState description="Não foi possível carregar horários." details={(slotsQuery.error as Error).message} onRetry={() => slotsQuery.refetch()} />`.
- Contacts loading (linha 478) / error (linha 481) → mesmo tratamento (`LoadingState inline` + `ErrorState`).
- Toasts de validação/erro de submit permanecem como estão.

**`appointments.new.services.tsx`**
- Loading (linha 80) → `<LoadingState inline size="sm" />`.
- Error (linha 83) → `<ErrorState description="Não foi possível carregar serviços." details={(query.error as Error).message} onRetry={() => query.refetch()} />`.

**`_admin/reconciliar.tsx`**
- Loading branch (linha ~144) → `<LoadingState />`.
- Error branch (linha ~150) → `<ErrorState description="Não foi possível carregar falhas." details={(failuresQ.error as Error).message} onRetry={() => failuresQ.refetch()} />`.
- Empty "Nenhuma falha em aberto" (linha 164) → `<EmptyState icon={<Check/>} title="Nenhuma falha em aberto" description="Tudo sincronizado." />`.

### i18n
Adicionar em `pt/en/fr`:
- `common.loading` = "Carregando…" / "Loading…" / "Chargement…"
- `common.error.title` = "Algo deu errado" / "Something went wrong" / "Une erreur est survenue"
- `common.error.retry` = "Tentar novamente" / "Try again" / "Réessayer"
- `common.error.details` = "Detalhes técnicos" / "Technical details" / "Détails techniques"

### Fora de escopo
- Lógica de dados, server functions, Supabase, GHL, migrations — intocados.
- Refator amplo de outras telas (auth, menu, reviews, services) — fica para depois.
- Substituição de toasts de erro de mutação — permanecem.

### Critérios de aceite
1. Empty/Error/Loading com visual consistente nas 5 telas listadas.
2. Mensagens técnicas escondidas em `<details>` ou mantidas no painel debug; nenhuma quebra de retry/refetch.
3. Componentes reutilizáveis (props mínimas, sem acoplamento a domínio).
4. Sem novas deps; build limpo.