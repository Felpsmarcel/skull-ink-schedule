## Filtros client-side no Financeiro

Tudo em `src/routes/_authenticated/financeiro.tsx`. Nenhuma alteração em `use-finance.ts`, `finance.functions.ts`, server functions, schema, RLS ou GHL.

### Estado e tipos
No componente `FinanceiroPage`, adicionar:
```tsx
type Period = "today" | "week" | "month" | "all";
type BucketFilter = "all" | "pago" | "pendente" | "a_receber";

const [period, setPeriod] = useState<Period>("all");
const [bucket, setBucket] = useState<BucketFilter>("all");
```

### Helper de filtro
Função pura no arquivo:
```tsx
function filterRows<T extends { startAt: string; bucket: PaymentBucket }>(
  rows: T[], period: Period, bucket: BucketFilter
): T[] {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0,0,0,0);
  const startOfWeek = new Date(startOfToday);
  // ISO-week: segunda como início
  const dow = (startOfToday.getDay() + 6) % 7;
  startOfWeek.setDate(startOfToday.getDate() - dow);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const from =
    period === "today" ? startOfToday.getTime() :
    period === "week"  ? startOfWeek.getTime()  :
    period === "month" ? startOfMonth.getTime() : null;

  return rows.filter((r) => {
    if (bucket !== "all" && r.bucket !== bucket) return false;
    if (from !== null && new Date(r.startAt).getTime() < from) return false;
    return true;
  });
}
```
Importar `PaymentBucket` de `@/lib/finance.functions`.

### UI dos filtros
Logo abaixo de `<main … className="… space-y-4 p-4">`, antes da renderização condicional Artist/Admin, dois grupos de pílulas:

```tsx
<section className="flex flex-col gap-2">
  <FilterRow
    label="Período"
    value={period}
    onChange={setPeriod}
    options={[
      { v: "today", l: "Hoje" },
      { v: "week",  l: "Semana" },
      { v: "month", l: "Mês" },
      { v: "all",   l: "Todos" },
    ]}
  />
  <FilterRow
    label="Status"
    value={bucket}
    onChange={setBucket}
    options={[
      { v: "all",       l: "Todos" },
      { v: "pago",      l: "Pago" },
      { v: "pendente",  l: "Pendente" },
      { v: "a_receber", l: "A receber" },
    ]}
  />
</section>
```

`FilterRow` é local — div com label `text-[10px] uppercase` e row `flex flex-wrap gap-1` de botões com `aria-pressed`, estilo coerente com o resto (border + bg-card; ativo: `bg-foreground text-background`). Sem novos pacotes; usa apenas Tailwind.

### Aplicação dos filtros
Passar as `rows` já filtradas para `ArtistView` e `AdminView` substituindo `data.rows`:
```tsx
const visibleRows = useMemo(
  () => filterRows(data.rows, period, bucket),
  [data.rows, period, bucket]
);
```
As views recebem `rows={visibleRows}` em vez de ler `data.rows`. Ajustar as assinaturas:
```tsx
function ArtistView({ data, rows }: { data: …; rows: typeof data.rows }) { … }
function AdminView ({ data, rows }: { data: …; rows: typeof data.rows }) { … }
```
Cards de resumo no topo continuam usando `data.aReceber/pendente/pago/…` (totais agregados do backend) — não recalculados localmente para evitar inconsistências.

### Estado vazio reflete filtros
Quando `rows.length === 0` E (`period !== "all"` ou `bucket !== "all"`), trocar o texto para "Nenhum agendamento com os filtros aplicados." Caso contrário, mantém "Sem agendamentos." Vale para cards mobile e linha da tabela.

### Permissões e segurança
- Estado de admin/artista vem de `data.role` (server). Filtro é apenas UI sobre rows que o server já autorizou.
- Botão Sincronizar e link Reconciliar continuam admin-only.

### Critérios de aceite (verificáveis)
1. Pílulas de período/status visíveis para admin e artista.
2. Filtrar por "Hoje/Semana/Mês" reduz a lista.
3. Filtrar por bucket reduz a lista.
4. Estado vazio mostra mensagem específica quando há filtros ativos.
5. Mobile cards + tabela em sm+ continuam funcionando; filtros não causam overflow horizontal (`flex-wrap`).
6. Cards de resumo no topo permanecem com os totais do backend.

### Fora de escopo
Filtro por tatuador, range de datas custom, exportação, persistência em URL — não nesta tarefa.
