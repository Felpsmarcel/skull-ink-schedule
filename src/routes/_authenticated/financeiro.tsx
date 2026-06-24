import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Wallet } from "lucide-react";
import { useFinanceSummary } from "@/hooks/use-finance";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { UserMenu } from "@/components/auth/user-menu";

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
  const { data, isLoading, error } = useFinanceSummary();

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
        <UserMenu />
      </header>

      <main className="flex-1 space-y-4 p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">A carregar…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        ) : !data ? null : data.role === "artist" ? (
          <ArtistView data={data} />
        ) : (
          <AdminView data={data} />
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

function ArtistView({ data }: { data: Extract<ReturnType<typeof useFinanceSummary>["data"], { role: "artist" }> }) {
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

      <section className="overflow-hidden rounded-lg border border-border">
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
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Sem agendamentos.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">{formatDateTime(r.startAt)}</td>
                  <td className="px-3 py-2">{r.servicesSummary || r.contactName || "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatCurrency(r.commissionEur)}
                  </td>
                  <td className="px-3 py-2 text-right text-[10px] uppercase tracking-wider">
                    {r.bucket}
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

function AdminView({ data }: { data: Extract<ReturnType<typeof useFinanceSummary>["data"], { role: "admin" }> }) {
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

      <section className="overflow-hidden rounded-lg border border-border">
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
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Sem agendamentos.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
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
                  <td className="px-3 py-2 text-right text-[10px] uppercase tracking-wider">
                    {r.bucket}
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