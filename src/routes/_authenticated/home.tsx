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
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionLabel } from "@/components/ui/section-label";

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
      <PageHeader
        eyebrow="Central operacional"
        title="Hoje"
        description={data?.dateLabel ?? "—"}
        leading={<img src={gfMark} alt="" className="h-9 w-9 object-contain" />}
        actions={(
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground" aria-live="polite">
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} aria-hidden />
            {dataUpdatedAt ? brusselsTime(new Date(dataUpdatedAt).toISOString()) : "—"}
          </span>
        )}
      />

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
          <section className="relative overflow-hidden rounded-lg border border-primary/45 bg-card p-5 shadow-[0_18px_55px_color-mix(in_oklab,var(--background)_65%,transparent)]">
            <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />
            <p className="text-xs font-bold uppercase text-primary">
              Próximo cliente
            </p>
            <div className="mt-4 flex items-center gap-4">
              <span className="font-display text-3xl font-bold tabular-nums text-foreground">{data.next.timeLabel}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{data.next.clientName}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {data.next.artistName ?? "Sem tatuador"} · {statusLabel(data.next.status)}
                </p>
              </div>
            </div>
            <Link
              to="/agenda"
              search={data.next.ghlAppointmentId ? { novo: data.next.ghlAppointmentId } : {}}
              className="mt-5 flex min-h-12 items-center justify-center rounded-md bg-primary text-sm font-bold uppercase text-primary-foreground transition-transform active:scale-[0.98]"
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
          <SectionLabel>Ações rápidas</SectionLabel>
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
              className="mt-3 flex min-h-12 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Wallet className="h-4 w-4" aria-hidden />
              <span className="flex-1">Financeiro</span>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </section>

        {/* 4. Fila do dia */}
        <section>
          <SectionLabel action={actions?.filaVerTodos ? (
              <Link to="/admin/fila" className="text-xs font-semibold uppercase text-primary underline-offset-4 hover:underline">
                Ver todos
              </Link>
            ) : null}>Fila do dia</SectionLabel>
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
      <span className="flex-1 text-xs font-medium uppercase text-muted-foreground">
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
      className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card px-2 text-center text-foreground transition-[border-color,background-color,transform] hover:border-primary/50 hover:bg-accent active:scale-[0.98]"
    >
      {icon}
      <span className="text-xs font-bold uppercase">{label}</span>
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
        <p className="truncate text-xs text-muted-foreground">
          {item.status === "em_atendimento" ? "Em atendimento" : "Aguardando"}
          {item.artistName ? ` · ${item.artistName}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-bold tabular-nums">{item.timeLabel}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{item.esperaMin} min</p>
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
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="flex-1 text-xs font-bold uppercase text-muted-foreground">
          Gestão
        </span>
        {alertas > 0 ? (
          <span className="rounded-sm bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
            {alertas}
          </span>
        ) : null}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground", open && "rotate-180")} aria-hidden />
      </Button>

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

          <p className="text-xs leading-5 text-muted-foreground">
            Vínculos incompletos: {gestao.vinculosNovos} novos desde a ativação da
            rastreabilidade · {gestao.vinculosHistorico} no histórico.
          </p>

          {gestao.degraded ? (
            <p className="text-xs leading-5 text-muted-foreground">
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
