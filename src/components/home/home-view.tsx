import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
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
  ArrowUpRight,
} from "lucide-react";
import {
  brusselsTime,
  type HomeDashboard,
  type HomeFilaItem,
  type Pendencia,
} from "@/lib/home-dashboard";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

type HomeViewProps = {
  data?: HomeDashboard;
  isLoading: boolean;
  isFetching: boolean;
  hasError: boolean;
  dataUpdatedAt: number;
  isAdmin: boolean;
  dayOverview?: ReactNode;
};

/** Presentation only; the route retains identity and server reads. */
export function HomeView({
  data,
  isLoading,
  isFetching,
  hasError,
  dataUpdatedAt,
  isAdmin,
  dayOverview,
}: HomeViewProps) {
  const actions = data?.actions;
  return (
    <div className="min-h-svh bg-background pb-[calc(env(safe-area-inset-bottom)+7rem)] text-foreground sm:pb-16">
      <PageHeader
        eyebrow="Central operacional"
        title="Hoje no estúdio"
        description={
          data?.dateLabel
            ? `${data.dateLabel} · Horário de Bruxelas`
            : "Agenda, chegadas e próximos atendimentos."
        }
        actions={
          <span
            className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
            aria-live="polite"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isFetching && "animate-spin motion-reduce:animate-none")}
              aria-hidden
            />
            Atualizado {dataUpdatedAt ? brusselsTime(new Date(dataUpdatedAt).toISOString()) : "—"}
          </span>
        }
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {hasError ? (
          <p
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            Não foi possível atualizar o resumo.{" "}
            {data
              ? "Os dados anteriores podem estar desatualizados."
              : "Resumo operacional indisponível."}
          </p>
        ) : null}
        <div
          className={cn(
            "grid items-start gap-6",
            isAdmin
              ? "lg:grid-cols-[minmax(0,1fr)_19rem] lg:grid-rows-[auto_1fr]"
              : "lg:grid-cols-[minmax(0,1fr)_22rem]",
          )}
        >
          {isAdmin ? (
            <div className="min-w-0 lg:col-start-2 lg:row-start-1">
              <NextClient data={data} isLoading={isLoading} hasError={hasError} />
            </div>
          ) : null}
          <div
            className={cn(
              "min-w-0 space-y-6",
              isAdmin && "lg:col-start-1 lg:row-start-1 lg:row-span-2",
            )}
          >
            {isAdmin ? (
              dayOverview
            ) : (
              <NextClient data={data} isLoading={isLoading} hasError={hasError} />
            )}
            <section
              aria-labelledby="home-queue"
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <h2 id="home-queue" className="font-editorial text-2xl">
                  Fila da recepção
                </h2>
                {actions?.filaVerTodos ? (
                  <Link
                    to="/admin/fila"
                    className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Ver fila <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </Link>
                ) : null}
              </div>
              <dl className="grid grid-cols-2 divide-x divide-border border-b border-border bg-muted/25">
                {[
                  ["Aguardando", data?.fila.aguardando],
                  ["Em atendimento", data?.fila.emAtendimento],
                ].map(([label, value]) => (
                  <div key={String(label)} className="px-5 py-4">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-2 text-2xl font-semibold tabular-nums">{value ?? "—"}</dd>
                  </div>
                ))}
              </dl>
              {isLoading ? (
                <p role="status" className="p-5 text-sm text-muted-foreground">
                  Consultando a fila…
                </p>
              ) : !data ? (
                <p className="p-5 text-sm text-muted-foreground">
                  Fila indisponível nesta leitura.
                </p>
              ) : data.fila.itens.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">Ninguém na fila agora.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.fila.itens.map((item) => (
                    <FilaRowHome key={item.codigo} item={item} />
                  ))}
                </ul>
              )}
            </section>
          </div>
          <aside
            aria-label="Atalhos e resumo operacional"
            className={cn("min-w-0 space-y-5", isAdmin && "lg:col-start-2 lg:row-start-2")}
          >
            <section
              aria-labelledby="home-actions"
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <div className="px-5 pb-2 pt-5">
                <h2 id="home-actions" className="font-editorial text-2xl">
                  Acesso rápido
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  As ferramentas para seguir o dia.
                </p>
              </div>
              <div className="divide-y divide-border px-5 pb-2">
                <QuickAction
                  to="/agenda"
                  icon={<CalendarDays className="h-4 w-4" />}
                  label="Abrir agenda"
                />
                {actions?.checkin ? (
                  <QuickAction
                    to="/totem"
                    icon={<QrCode className="h-4 w-4" />}
                    label="Totem de check-in"
                  />
                ) : null}
                {actions?.pagamento ? (
                  <QuickAction
                    to="/movimentacao"
                    icon={<Banknote className="h-4 w-4" />}
                    label="Registrar recebimento"
                  />
                ) : null}
                {actions?.financeiro ? (
                  <QuickAction
                    to="/financeiro"
                    icon={<Wallet className="h-4 w-4" />}
                    label="Financeiro"
                  />
                ) : null}
                {isAdmin ? (
                  <QuickAction
                    to="/painel-tatuador"
                    icon={<Activity className="h-4 w-4" />}
                    label="Painel André"
                  />
                ) : null}
              </div>
            </section>
            {data?.gestao ? <GestaoSection gestao={data.gestao} /> : null}
          </aside>
        </div>
      </main>
    </div>
  );
}

function NextClient({
  data,
  isLoading,
  hasError,
}: Pick<HomeViewProps, "data" | "isLoading" | "hasError">) {
  return (
    <section
      aria-labelledby="home-next"
      className="overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-sm"
    >
      <div className="flex items-center gap-2 border-b border-border bg-accent/40 px-5 py-4">
        <Clock className="h-4 w-4 text-primary" aria-hidden />
        <h2 id="home-next" className="text-sm font-semibold">
          Próximo cliente
        </h2>
      </div>
      <div className="p-5">
        {isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Consultando os próximos horários…
          </p>
        ) : data?.next ? (
          <>
            <p className="font-editorial text-4xl tabular-nums text-primary">
              {data.next.timeLabel}
            </p>
            <p className="mt-3 break-words text-lg font-semibold">{data.next.clientName}</p>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {data.next.artistName ?? "Sem tatuador"}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Agenda: {statusLabel(data.next.status)}
            </p>
            <Button asChild className="mt-5 min-h-11 w-full rounded-xl">
              <Link
                to="/agenda"
                search={data.next.ghlAppointmentId ? { novo: data.next.ghlAppointmentId } : {}}
              >
                Abrir na agenda <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            {!data || hasError
              ? "Próximo horário indisponível nesta leitura."
              : "Nenhum próximo cliente nesta leitura do dia."}
          </p>
        )}
      </div>
    </section>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="group flex min-h-14 items-center gap-3 py-3 text-sm font-medium transition-colors hover:text-primary"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 break-words">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
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
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="flex-1 text-xs font-bold uppercase text-muted-foreground">Gestão</span>
        {alertas > 0 ? (
          <span className="rounded-sm bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
            {alertas}
          </span>
        ) : null}
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground", open && "rotate-180")}
          aria-hidden
        />
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
            className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-xs"
          >
            <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="flex-1">Saúde do sistema</span>
            <span className="text-base font-bold tabular-nums">{gestao.incidentesAbertos}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          </Link>

          <p className="text-xs leading-5 text-muted-foreground">
            Vínculos incompletos: {gestao.vinculosNovos} novos desde a ativação da rastreabilidade ·{" "}
            {gestao.vinculosHistorico} no histórico.
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
        className="flex min-h-12 items-center gap-3 rounded-xl border border-border px-3 py-2"
      >
        <AlertTriangle
          className={cn("h-4 w-4", p.severity === "critica" ? "text-destructive" : "text-warning")}
          aria-hidden
        />
        <span className="min-w-0 flex-1 break-words text-xs">{p.label}</span>
        <span className="text-base font-bold tabular-nums">{p.count}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
