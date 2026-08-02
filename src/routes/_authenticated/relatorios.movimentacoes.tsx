import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  ExternalLink,
  FileCode2,
  Printer,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { useArtists } from "@/hooks/use-artists";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getMovimentacoesReport } from "@/lib/movimentacao.functions";
import { formatCurrency, formatDate } from "@/lib/format";
import { STAFF_RECEBEDORES } from "@/config/movimentacao-slugs";
import {
  aggregateReport,
  buildReportHtml,
  downloadReportHtml,
  exportReportCSV,
  metodoLabel,
  TIPO_LABELS,
  type BreakdownItem,
  type ReportRow,
} from "@/lib/report-html";

const searchSchema = z.object({
  start: fallback(z.string(), "").default(""),
  end: fallback(z.string(), "").default(""),
  artist: fallback(z.string(), "").default(""),
  tipo: fallback(z.string(), "").default(""),
  recebedor: fallback(z.string(), "").default(""),
  sync: fallback(z.string(), "").default(""),
  origem: fallback(z.string(), "").default(""),
  registrador: fallback(z.string(), "").default(""),
});

const ORIGEM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Todas as origens" },
  { value: "link_individual", label: "Link do tatuador" },
  { value: "manual", label: "Lançamento manual" },
];

export const Route = createFileRoute("/_authenticated/relatorios/movimentacoes")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Relatório de pagamentos — GF Tattoo Studio" },
      {
        name: "description",
        content: "Dashboard de pagamentos registados com totais por forma, tatuador e tipo.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: RelatorioMovimentacoesPage,
});

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthRange(offset: number): { start: string; end: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { start: iso(first), end: iso(last) };
}

const TIPO_OPTIONS = Object.entries(TIPO_LABELS);

const SYNC_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Todos" },
  { value: "synced", label: "Sincronizado" },
  { value: "pending", label: "Pendente" },
  { value: "failed", label: "Com falha" },
];

function RelatorioMovimentacoesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: me } = useCurrentUser();
  const { data: artists } = useArtists();
  const isAdmin = me?.role === "admin";

  const current = monthRange(0);
  const start = search.start || current.start;
  const end = search.end || current.end;

  const fetchReport = useServerFn(getMovimentacoesReport);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "movimentacoes-report",
      start,
      end,
      search.artist,
      search.tipo,
      search.recebedor,
      search.sync,
      search.origem,
      search.registrador,
    ],
    queryFn: () =>
      fetchReport({
        data: {
          start,
          end,
          artistId: search.artist || null,
          tipo: search.tipo || null,
          recebedor: search.recebedor || null,
          syncStatus: (search.sync as "pending" | "synced" | "failed" | "") || null,
          origem: (search.origem as "link_individual" | "manual" | "") || null,
          registrador: search.registrador || null,
        },
      }),
    staleTime: 30_000,
  });

  const rows = data?.rows ?? [];
  const agg = useMemo(() => aggregateReport(rows), [rows]);

  const failedRows = useMemo(
    () => rows.filter((r) => r.ghl_sync_status === "failed"),
    [rows],
  );
  const estornoRows = useMemo(
    () => rows.filter((r) => r.tipo_movimento === "estorno"),
    [rows],
  );
  const valorLiquido = useMemo(
    () => agg.total - estornoRows.reduce((s, r) => s + r.total, 0),
    [agg.total, estornoRows],
  );

  const periodoLabel = `${formatDate(start)} — ${formatDate(end)}`;

  function setSearch(patch: Partial<typeof search>) {
    navigate({ search: (prev: typeof search) => ({ ...prev, ...patch }) });
  }

  const origemLabel = ORIGEM_OPTIONS.find((o) => o.value === search.origem)?.label;

  const filtrosLabel = useMemo(() => {
    const parts: string[] = [];
    if (search.artist) {
      parts.push(
        `Tatuador: ${(artists ?? []).find((a) => a.id === search.artist)?.name ?? search.artist}`,
      );
    }
    if (search.recebedor) {
      parts.push(
        `Recebido por: ${STAFF_RECEBEDORES.find((s) => s.appUserId === search.recebedor)?.displayName ?? search.recebedor}`,
      );
    }
    if (search.registrador) {
      parts.push(
        `Registado por: ${STAFF_RECEBEDORES.find((s) => s.id === search.registrador)?.displayName ?? search.registrador}`,
      );
    }
    if (search.tipo) parts.push(`Tipo: ${TIPO_LABELS[search.tipo] ?? search.tipo}`);
    if (search.sync) {
      parts.push(`Sync: ${SYNC_OPTIONS.find((o) => o.value === search.sync)?.label ?? search.sync}`);
    }
    if (search.origem) parts.push(`Origem: ${origemLabel ?? search.origem}`);
    return parts.length > 0 ? parts.join(" · ") : "Sem filtros (todos os lançamentos)";
  }, [artists, origemLabel, search]);

  function handleExportHtml() {
    if (rows.length === 0) {
      toast.error("Nada para exportar");
      return;
    }
    const html = buildReportHtml(rows, agg, {
      periodoLabel,
      geradoPor: me?.email ?? "—",
      geradoEm: new Date(),
      origemLabel: origemLabel ? `Relatório de pagamentos — ${origemLabel}` : undefined,
      filtrosLabel,
    });
    downloadReportHtml(html, `relatorio-pagamentos-${start}_${end}.html`);
    toast.success("Relatório HTML exportado");
  }

  function handleExportCsv() {
    if (rows.length === 0) {
      toast.error("Nada para exportar");
      return;
    }
    exportReportCSV(rows, `relatorio-pagamentos-${start}_${end}.csv`);
    toast.success(`Exportado: ${rows.length} linha(s)`);
  }

  const hasFilters =
    search.artist ||
    search.tipo ||
    search.recebedor ||
    search.sync ||
    search.origem ||
    search.registrador;

  return (
    <div className="min-h-svh bg-background pb-[calc(env(safe-area-inset-bottom)+7rem)] text-foreground sm:pb-24">
      <header className="no-print sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <Link to="/menu" className="rounded-md p-2 hover:bg-muted" aria-label="Voltar ao menu">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="flex-1 text-base font-bold uppercase tracking-wider">Relatório de pagamentos</h1>
      </header>

      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4 print:max-w-none print:px-0">
        {/* Filtros */}
        <div className="no-print space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearch(monthRange(0))}
            >
              Mês atual
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearch(monthRange(-1))}
            >
              Mês anterior
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="De">
              <Input
                type="date"
                value={start}
                onChange={(e) => setSearch({ start: e.target.value })}
                className="h-11"
              />
            </Field>
            <Field label="Até">
              <Input
                type="date"
                value={end}
                onChange={(e) => setSearch({ end: e.target.value })}
                className="h-11"
              />
            </Field>
            {isAdmin && (
              <>
                <Field label="Tatuador">
                  <select
                    value={search.artist}
                    onChange={(e) => setSearch({ artist: e.target.value })}
                    className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Todos</option>
                    {(artists ?? []).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Recebido por">
                  <select
                    value={search.recebedor}
                    onChange={(e) => setSearch({ recebedor: e.target.value })}
                    className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Todos</option>
                    {STAFF_RECEBEDORES.map((s) => (
                      <option key={s.appUserId} value={s.appUserId}>
                        {s.displayName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Registado por">
                  <select
                    value={search.registrador}
                    onChange={(e) => setSearch({ registrador: e.target.value })}
                    className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Todos</option>
                    {STAFF_RECEBEDORES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.displayName}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field label="Tipo">
              <select
                value={search.tipo}
                onChange={(e) => setSearch({ tipo: e.target.value })}
                className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Todos</option>
                {TIPO_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sync GHL">
              <select
                value={search.sync}
                onChange={(e) => setSearch({ sync: e.target.value })}
                className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {SYNC_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Origem">
              <select
                value={search.origem}
                onChange={(e) => setSearch({ origem: e.target.value })}
                className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {ORIGEM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="button" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleExportHtml}>
              <FileCode2 className="h-4 w-4" /> Exportar HTML
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleExportCsv}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            {hasFilters && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setSearch({
                    artist: "",
                    tipo: "",
                    recebedor: "",
                    sync: "",
                    origem: "",
                    registrador: "",
                  })
                }
              >
                <RotateCcw className="h-4 w-4" /> Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Cabeçalho de impressão */}
        <div className="hidden print:block">
          <h2 className="text-lg font-bold uppercase tracking-wider">
            GF Tattoo — Relatório de pagamentos
          </h2>
          <p className="text-xs text-muted-foreground">Período: {periodoLabel}</p>
          <p className="text-xs text-muted-foreground">Filtros: {filtrosLabel}</p>
          <p className="text-xs text-muted-foreground">
            Gerado por {me?.email ?? "—"} em {formatDate(new Date())}
          </p>
        </div>

        {isLoading ? (
          <LoadingState label="Carregando relatório..." />
        ) : error ? (
          <ErrorState description={(error as Error).message} onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="Sem pagamentos"
            description="Nenhum pagamento registado no período selecionado."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card k="Total recebido" v={formatCurrency(agg.total)} />
              <Card k="Pagamentos" v={String(agg.count)} />
              <Card k="Ticket médio" v={formatCurrency(agg.ticketMedio)} />
              <Card
                k="Sync pendente"
                v={formatCurrency(agg.pendenteValor)}
                sub={`${agg.pendenteCount} registo(s)`}
              />
            </div>

            {estornoRows.length > 0 && (
              <AlertCard
                icon={<Receipt className="h-4 w-4" />}
                title="Estornos no período"
                value={formatCurrency(estornoRows.reduce((s, r) => s + r.total, 0))}
                sub={`${estornoRows.length} registo(s) · Líquido ${formatCurrency(valorLiquido)}`}
                tone="warn"
              />
            )}

            {failedRows.length > 0 && (
              <AlertCard
                icon={<AlertTriangle className="h-4 w-4" />}
                title="Sync GHL com falha"
                value={String(failedRows.length)}
                sub={`${formatCurrency(failedRows.reduce((s, r) => s + r.total, 0))} não sincronizado`}
                tone="danger"
                action={
                  search.sync !== "failed" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSearch({ sync: "failed" })}
                    >
                      Ver falhas
                    </Button>
                  ) : null
                }
              />
            )}

            <Breakdown title="Por forma de pagamento" items={agg.porForma} />
            <Breakdown title="Por tatuador" items={agg.porTatuador} />
            <Breakdown title="Por tipo de movimento" items={agg.porTipo} />

            <section className="space-y-2">
              <h2 className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Detalhe ({rows.length})
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {rows.map((r) => (
                  <ReportRowItem key={r.id} row={r} />
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Card({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{v}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Breakdown({ title, items }: { title: string; items: BreakdownItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {items.map((i) => (
          <li key={i.label} className="px-4 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm">{i.label}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatCurrency(i.value)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${i.pct}%` }} />
              </div>
              <span className="w-20 text-right text-[10px] text-muted-foreground">
                {i.count} · {i.pct}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AlertCard({
  icon,
  title,
  value,
  sub,
  tone,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  sub: string;
  tone: "warn" | "danger";
  action?: React.ReactNode;
}) {
  const border = tone === "danger" ? "border-red-500/40" : "border-amber-500/40";
  const bg = tone === "danger" ? "bg-red-500/10" : "bg-amber-500/10";
  const text = tone === "danger" ? "text-red-600" : "text-amber-600";
  return (
    <div className={`rounded-lg border ${border} ${bg} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={text}>{icon}</span>
          <div>
            <p className={`text-sm font-semibold ${text}`}>{title}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold tabular-nums ${text}`}>{value}</p>
          {action && <div className="mt-1.5">{action}</div>}
        </div>
      </div>
    </div>
  );
}

function ReportRowItem({ row }: { row: ReportRow }) {
  return (
    <li className="group relative space-y-1 px-4 py-3">
      <Link
        to="/movimentacao/historico/$id/editar"
        params={{ id: row.id }}
        className="absolute inset-0 z-10"
        aria-label={`Editar pagamento de ${row.nome_cliente}`}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{row.nome_cliente}</p>
          <p className="text-[11px] text-muted-foreground">
            {formatDate(row.data_pagamento)} · {row.tatuador ?? "—"}
            {row.recebido_por_nome ? ` · Recebido por ${row.recebido_por_nome}` : ""}
          </p>
          {row.registrado_por_nome && (
            <p className="text-[11px] text-muted-foreground">
              Registado por {row.registrado_por_nome}
            </p>
          )}
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums">
          {formatCurrency(row.total)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge variant="info">
          {TIPO_LABELS[row.tipo_movimento] ?? row.tipo_movimento}
        </StatusBadge>
        <span className="text-[11px] text-muted-foreground">{metodoLabel(row)}</span>
        <StatusBadge variant={row.ghl_sync_status === "synced" ? "success" : "warning"}>
          {row.ghl_sync_status === "synced" ? "Sync" : "Pendente"}
        </StatusBadge>
        <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </li>
  );
}