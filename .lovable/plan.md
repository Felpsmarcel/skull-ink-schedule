## Financeiro: cards no mobile, tabela em sm+

Edição apenas em `src/routes/_authenticated/financeiro.tsx`. Cálculos, server functions e dados intactos. Nenhum filtro adicionado.

### Estratégia
Para cada visão (Artist/Admin), renderizar **duas listas irmãs** sobre o mesmo `data.rows`:
- **Cards**: `<section className="space-y-2 sm:hidden">…</section>`
- **Tabela atual**: envolver em `<section className="hidden overflow-hidden rounded-lg border border-border sm:block">…</section>`

Assim a tabela só aparece a partir de `sm` (≥640px) e o mobile vê cards. Estados vazio/loading/erro continuam vindo do bloco pai (sem mudanças).

### Card — Artist
Mostra: serviço (ou cliente como fallback) · data/hora · status (badge) · comissão (destaque).

```tsx
<article className="rounded-lg border border-border bg-card p-3">
  <div className="flex items-start justify-between gap-2">
    <div className="min-w-0">
      <div className="truncate text-sm font-medium">
        {r.servicesSummary || r.contactName || "—"}
      </div>
      <div className="text-[11px] text-muted-foreground">{formatDateTime(r.startAt)}</div>
    </div>
    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      {r.bucket}
    </span>
  </div>
  <div className="mt-2 flex items-baseline justify-between">
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Comissão</span>
    <span className="text-sm font-semibold">{formatCurrency(r.commissionEur)}</span>
  </div>
</article>
```

### Card — Admin
Mostra: cliente + serviço · data/hora · status · total · comissão · estúdio.

```tsx
<article className="rounded-lg border border-border bg-card p-3 space-y-2">
  <div className="flex items-start justify-between gap-2">
    <div className="min-w-0">
      <div className="truncate text-sm font-medium">{r.contactName ?? "—"}</div>
      <div className="truncate text-[11px] text-muted-foreground">{r.servicesSummary}</div>
      <div className="text-[11px] text-muted-foreground">{formatDateTime(r.startAt)}</div>
    </div>
    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      {r.bucket}
    </span>
  </div>
  <div className="grid grid-cols-3 gap-2 border-t border-border pt-2 text-right">
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
      <div className="text-sm font-semibold">{formatCurrency(r.totalEur)}</div>
    </div>
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Comissão</div>
      <div className="text-sm font-semibold text-amber-600">{formatCurrency(r.commissionEur)}</div>
    </div>
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Estúdio</div>
      <div className="text-sm font-semibold text-emerald-600">{formatCurrency(r.studioEur)}</div>
    </div>
  </div>
</article>
```

### Estado vazio mobile
Quando `data.rows.length === 0`, renderizar nos cards um único bloco:
```tsx
<div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
  Sem agendamentos.
</div>
```
A tabela já cobre o caso vazio em sm+.

### O que NÃO muda
- Cards de resumo (`StatCard`) no topo — preservados.
- Lógica admin × artista, comissão, totais — preservados.
- Botão Sincronizar (admin) e link Reconciliar — preservados.
- Estados de loading/erro no bloco pai — preservados.
- Sem novos imports, sem mudança em `format.ts`.

### Critérios de aceite (verificação)
1. <640px → cards visíveis, tabela oculta.
2. ≥640px → tabela visível, cards ocultos.
3. Admin vê total/comissão/estúdio nos dois layouts; artista vê apenas comissão.
4. Sincronizar e Reconciliar continuam admin-only.
5. Sem agendamentos → mensagem aparece em ambos os modos.
