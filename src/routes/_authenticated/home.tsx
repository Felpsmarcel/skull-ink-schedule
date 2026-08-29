import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Banknote,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  QrCode,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useHomeDashboard } from "@/hooks/use-home-dashboard";
import { brusselsTime, type HomeFilaItem, type Pendencia } from "@/lib/home-dashboard";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import gfMark from "@/assets/gf-mark.png";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Central operacional — GF Tattoo Studio" },
      {
        name: "description",
        content: "Próximo cliente, fila do dia e ações rápidas do GF Tattoo Studio.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data, isLoading, isFetching, error, dataUpdatedAt } = useHomeDashboard();
  const actions = data?.actions;
  const gestao = data?.gestao;

  return (
    <div className="min-h-svh bg-background pb-[calc(env(safe-area-inset-bottom)+7rem)] text-foreground sm:pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <img src={gfMark} alt="" className="h-7 w-7 object-contain" />
        <div className="flex-1">
          <h1 className="text-base font-bold uppercase tracking-wider">Hoje</h1>
          <p className="text-[11px] capitalize text-muted-foreground">
            {data?.dateLabel ?? "—"}
          </p>
        </div>
        <span
          className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground"
          aria-live="polite"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} aria-hidden />
          {dataUpdatedAt ? brusselsTime(new Date(dataUpdatedAt).toISOString()) : "—"}
        </span>
      </header>

      <div className="mx-auto max-w-md space-y-5 px-4 py-4 sm:max-w-3xl">
        {error ? (
          <p className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
            Não foi possível atualizar agora. Os dados podem estar desatualizados.
          </p>
        ) : null}

        {/* 1. Próximo cliente */}
        {isLoading ? (
          <div className="h-28 animate-pulse rounded-lg border border-border bg-card" />
        ) : data?.next ? (
          <section className="rounded-lg border border-border bg-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Próximo cliente
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-3xl font-bold tabular-nums">{data.next.timeLabel}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{data.next.clientName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {data.next.artistName ?? "Sem tatuador"} · {statusLabel(data.next.status)}
                </p>
              </div>
            </div>
            <Link
              to="/agenda"
              search={data.next.ghlAppointmentId ? { novo: data.next.ghlAppointmentId } : {}}
              className="mt-3 flex min-h-11 items-center justify-center rounded-md bg-primary text-sm font-bold uppercase tracking-wider text-primary-foreground active:scale-[0.98]"
            >
              Abrir
            </Link>
          </section>
        ) : (
          <section className="rounded-lg border border-dashed border-border bg-card p-5 text-center">
            <p className="text-sm text-muted-foreground">Nenhum cliente restante hoje.</p>
          </section>
        )}

        {/* 2. Faixa fila */}
        <div className="flex items-stretch divide-x divide-border overflow-hidden rounded-lg border border-border bg-card">
          <FaixaItem label="Aguardando" value={data?.fila.aguardando ?? 0} />
          <FaixaItem label="Em atendimento" value={data?.fila.emAtendimento ?? 0} />
        </div>

        {/* 3. Ações rápidas */}
        <section>
          <h2 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Ações rápidas
          </h2>
          <div
            className={cn(
              "grid gap-3",
              actions?.pagamento ? "grid-cols-3" : "grid-cols-1",
            )}
          >
            <Acao to="/agenda" icon={<CalendarDays className="h-5 w-5" />} label="Agenda" />
            {actions?.checkin ? (
              <Acao to="/totem" icon={<QrCode className="h-5 w-5" />} label="Check-in" />
            ) : null}
            {actions?.pagamento ? (
              <Acao
                to="/movimentacao"
                icon={<Banknote className="h-5 w-5" />}
                label="Pagamento"
              />
            ) : null}
          </div>
          {actions?.financeiro ? (
            <Link
              to="/financeiro"
              className="mt-3 flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground"
            >
              <Wallet className="h-4 w-4" aria-hidden />
              <span className="flex-1">Financeiro</span>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </section>

        {/* 4. Fila do dia */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Fila do dia
            </h2>
            {actions?.filaVerTodos ? (
              <Link to="/admin/fila" className="text-[10px] uppercase tracking-wider text-muted-foreground underline">
                Ver todos
              </Link>
            ) : null}
          </div>
          {isLoading ? (
            <div className="h-16 animate-pulse rounded-lg border border-border bg-card" />
          ) : (data?.fila.itens.length ?? 0) === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-card p-4 text-center text-xs text-muted-foreground">
              Ninguém na fila agora.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {data?.fila.itens.map((item) => <FilaRowHome key={item.codigo} item={item} />)}
            </ul>
          )}
        </section>

        {/* 5. Gestão (admin) */}
        {gestao ? <GestaoSection gestao={gestao} /> : null}
      </div>
    </div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "confirmed":
      return "Confirmado";
    case "pending":
      return "Pendente";
    case "completed":
      return "Concluído";
    default:
      return status;
  }
}

function FaixaItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-1 items-center gap-2 px-4 py-3">
      <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
      <span className="flex-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-xl font-bold tabular-nums">{value}</span>
    </div>
  );
}

function Acao({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-lg bg-primary px-2 text-center text-primary-foreground active:scale-[0.98]"
    >
      {icon}
      <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
    </Link>
  );
}

function FilaRowHome({ item }: { item: HomeFilaItem }) {
  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          item.status === "em_atendimento" ? "bg-primary" : "bg-muted-foreground",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.clientName}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {item.status === "em_atendimento" ? "Em atendimento" : "Aguardando"}
          {item.artistName ? ` · ${item.artistName}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-bold tabular-nums">{item.timeLabel}</p>
        <p className="text-[10px] text-muted-foreground tabular-nums">{item.esperaMin} min</p>
      </div>
    </li>
  );
}

function GestaoSection({
  gestao,
}: {
  gestao: NonNullable<import("@/lib/home-dashboard").HomeDashboard["gestao"]>;
}) {
  const [open, setOpen] = useState(false);
  const alertas = gestao.pendencias.length;

  return (
    <section className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Gestão
        </span>
        {alertas > 0 ? (
          <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
            {alertas}
          </span>
        ) : null}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-border px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Recebido hoje</span>
            <span className="text-lg font-bold tabular-nums">
              {formatCurrency(gestao.recebidoHoje)}
            </span>
          </div>

          {gestao.pendencias.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem pendências operacionais.</p>
          ) : (
            <ul className="space-y-2">
              {gestao.pendencias.map((p) => (
                <PendenciaRow key={p.kind} p={p} />
              ))}
            </ul>
          )}

          <Link
            to="/admin/saude"
            className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-xs"
          >
            <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="flex-1">Saúde do sistema</span>
            <span className="text-base font-bold tabular-nums">{gestao.incidentesAbertos}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          </Link>

          <p className="text-[11px] text-muted-foreground">
            Vínculos incompletos: {gestao.vinculosNovos} novos desde a ativação da
            rastreabilidade · {gestao.vinculosHistorico} no histórico.
          </p>

          {gestao.degraded ? (
            <p className="text-[11px] text-muted-foreground">
              Alguns indicadores de gestão não carregaram nesta atualização.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PendenciaRow({ p }: { p: Pendencia }) {
  return (
    <li>
      <Link
        to={p.to}
        className="flex min-h-12 items-center gap-3 rounded-md border border-border px-3 py-2"
      >
        <AlertTriangle
          className={cn(
            "h-4 w-4",
            p.severity === "critica" ? "text-destructive" : "text-muted-foreground",
          )}
          aria-hidden
        />
        <span className="flex-1 text-xs">{p.label}</span>
        <span className="text-base font-bold tabular-nums">{p.count}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
