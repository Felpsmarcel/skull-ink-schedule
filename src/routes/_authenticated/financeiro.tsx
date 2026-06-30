import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, RefreshCw, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useFinanceSummary } from "@/hooks/use-finance";
import { useIsAdmin } from "@/hooks/use-current-user";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { runGhlSync } from "@/lib/sync.functions";
import type { PaymentBucket } from "@/lib/finance.functions";

type Period = "today" | "week" | "month" | "all";
type BucketFilter = "all" | PaymentBucket;

function filterRows<T extends { startAt: string; bucket: PaymentBucket }>(
  rows: T[],
  period: Period,
  bucket: BucketFilter,
): T[] {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  const dow = (startOfToday.getDay() + 6) % 7;
  startOfWeek.setDate(startOfToday.getDate() - dow);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const from =
    period === "today"
      ? startOfToday.getTime()
      : period === "week"
        ? startOfWeek.getTime()
        : period === "month"
          ? startOfMonth.getTime()
          : null;
  return rows.filter((r) => {
    if (bucket !== "all" && r.bucket !== bucket) return false;
    if (from !== null && new Date(r.startAt).getTime() < from) return false;
    return true;
  });
}

function FilterRow<V extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: V;
  onChange: (v: V) => void;
  options: ReadonlyArray<{ v: V; l: string }>;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const active = o.v === value;
          return (
            <button
              key={o.v}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.v)}
              className={
                "rounded-full border px-3 py-1 text-xs transition " +
                (active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-foreground hover:bg-muted")
              }
            >
              {o.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — GF Tattoo Studio" },
      { name: "description", content: "Resumo financeiro e comissões" },
    ],
  }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useFinanceSummary();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const sync = useServerFn(runGhlSync);
  const syncM = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r) => {
      toast.success(
        `Sync · ${r.inserted} novos · ${r.updated} atualizados · ${r.failures} falhas`,
      );
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      qc.invalidateQueries({ queryKey: ["sync-failures"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const [period, setPeriod] = useState<Period>("all");
  const [bucket, setBucket] = useState<BucketFilter>("all");
  const filtersActive = period !== "all" || bucket !== "all";
  const emptyMsg = filtersActive
    ? "Nenhum agendamento com os filtros aplicados."
    : "Sem agendamentos.";

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-20">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate({ to: "/agenda" })}
            className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="flex items-center gap-2 text-base font-semibold">
            <Wallet className="h-4 w-4" /> Financeiro
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncM.mutate()}
                disabled={syncM.isPending}
              >
                <RefreshCw
                  className={`mr-2 h-3.5 w-3.5 ${syncM.isPending ? "animate-spin" : ""}`}
                />
                Sincronizar
              </Button>
              <Link
                to="/reconciliar"
                className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
                aria-label="Reconciliar"
              >
                <AlertTriangle className="h-4 w-4" />
              </Link>
            </>
          ) : null}
        </div>
      </header>

      <main className="flex-1 space-y-4 p-4">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState
            description="Não foi possível carregar o financeiro."
            details={(error as Error).message}
            onRetry={() => refetch()}
          />
        ) : !data ? null : (
          <>
            <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
              <FilterRow
                label="Período"
                value={period}
                onChange={setPeriod}
                options={[
                  { v: "today", l: "Hoje" },
                  { v: "week", l: "Semana" },
                  { v: "month", l: "Mês" },
                  { v: "all", l: "Todos" },
                ]}
              />
              <FilterRow
                label="Status"
                value={bucket}
                onChange={setBucket}
                options={[
                  { v: "all", l: "Todos" },
                  { v: "pago", l: "Pago" },
                  { v: "pendente", l: "Pendente" },
                  { v: "a_receber", l: "A receber" },
                ]}
              />
            </section>
            {data.role === "artist" ? (
              <ArtistView
                data={data}
                rows={filterRows(data.rows, period, bucket)}
                emptyMsg={emptyMsg}
              />
            ) : (
              <AdminView
                data={data}
                rows={filterRows(data.rows, period, bucket)}
                emptyMsg={emptyMsg}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "muted" }) {
  const toneCls =
    tone === "good"
      ? "text-emerald-600"
      : tone === "warn"
      ? "text-amber-600"
      : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${toneCls}`}>{value}</div>
    </div>
  );
}

function ArtistView({
  data,
  rows,
  emptyMsg,
}: {
  data: Extract<ReturnType<typeof useFinanceSummary>["data"], { role: "artist" }>;
  rows: Extract<ReturnType<typeof useFinanceSummary>["data"], { role: "artist" }>["rows"];
  emptyMsg: string;
}) {
  return (
    <>
      <section className="grid grid-cols-3 gap-2">
        <StatCard label="A receber" value={formatCurrency(data.aReceber)} />
        <StatCard label="Pendente" value={formatCurrency(data.pendente)} tone="warn" />
        <StatCard label="Pago" value={formatCurrency(data.pago)} tone="good" />
      </section>
      <p className="text-[11px] text-muted-foreground">
        Valores exibidos são a sua comissão (40%).
      </p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground sm:hidden">
          {emptyMsg}
        </div>
      ) : (
        <section className="space-y-2 sm:hidden">
          {rows.map((r) => (
            <article key={r.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {r.servicesSummary || r.contactName || "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{formatDateTime(r.startAt)}</div>
                </div>
                <StatusBadge variant={bucketToVariant(r.bucket)} className="shrink-0">
                  {bucketLabel(r.bucket)}
                </StatusBadge>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Comissão</span>
                <span className="text-sm font-semibold">{formatCurrency(r.commissionEur)}</span>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="hidden overflow-hidden rounded-lg border border-border sm:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Serviço</th>
              <th className="px-3 py-2 text-right">Comissão</th>
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  {emptyMsg}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">{formatDateTime(r.startAt)}</td>
                  <td className="px-3 py-2">{r.servicesSummary || r.contactName || "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatCurrency(r.commissionEur)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <StatusBadge variant={bucketToVariant(r.bucket)}>
                      {bucketLabel(r.bucket)}
                    </StatusBadge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}

function AdminView({
  data,
  rows,
  emptyMsg,
}: {
  data: Extract<ReturnType<typeof useFinanceSummary>["data"], { role: "admin" }>;
  rows: Extract<ReturnType<typeof useFinanceSummary>["data"], { role: "admin" }>["rows"];
  emptyMsg: string;
}) {
  return (
    <>
      <section className="grid grid-cols-3 gap-2">
        <StatCard label="Total bruto" value={formatCurrency(data.totalBruto)} />
        <StatCard label="Comissão (40%)" value={formatCurrency(data.comissaoTotal)} tone="warn" />
        <StatCard label="Estúdio (60%)" value={formatCurrency(data.estudioTotal)} tone="good" />
      </section>
      <section className="grid grid-cols-3 gap-2">
        <StatCard label="Pago" value={formatCurrency(data.pago)} tone="good" />
        <StatCard label="Pendente" value={formatCurrency(data.pendente)} tone="warn" />
        <StatCard label="A receber" value={formatCurrency(data.aReceber)} />
      </section>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground sm:hidden">
          {emptyMsg}
        </div>
      ) : (
        <section className="space-y-2 sm:hidden">
          {rows.map((r) => (
            <article key={r.id} className="space-y-2 rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.contactName ?? "—"}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{r.servicesSummary}</div>
                  <div className="text-[11px] text-muted-foreground">{formatDateTime(r.startAt)}</div>
                </div>
                <StatusBadge variant={bucketToVariant(r.bucket)} className="shrink-0">
                  {bucketLabel(r.bucket)}
                </StatusBadge>
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
          ))}
        </section>
      )}

      <section className="hidden overflow-hidden rounded-lg border border-border sm:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Cliente / Serviço</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Comissão 40%</th>
              <th className="px-3 py-2 text-right">Estúdio 60%</th>
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  {emptyMsg}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">{formatDateTime(r.startAt)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.contactName ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{r.servicesSummary}</div>
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrency(r.totalEur)}</td>
                  <td className="px-3 py-2 text-right text-amber-600">
                    {formatCurrency(r.commissionEur)}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-600">
                    {formatCurrency(r.studioEur)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <StatusBadge variant={bucketToVariant(r.bucket)}>
                      {bucketLabel(r.bucket)}
                    </StatusBadge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}