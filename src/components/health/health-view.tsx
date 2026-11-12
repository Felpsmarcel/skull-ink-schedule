import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  RefreshCw,
  ScanLine,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  SEVERITY_LABEL,
  SOURCE_LABEL,
  brusselsStamp,
  type HealthLevel,
  type Incident,
  type OperationalHealth,
} from "@/lib/observability";

const LEVEL_TEXT: Record<HealthLevel, string> = {
  ok: "Operação saudável",
  atencao: "Requer atenção",
  critico: "Falha crítica ativa",
};
const STATUS_TEXT = { open: "Em aberto", acknowledged: "Reconhecido", resolved: "Resolvido" };

export interface HealthViewProps {
  data?: OperationalHealth;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error?: unknown;
  onRefresh: () => void;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  busy: boolean;
}

/** Presentation only. Reads and incident mutations remain owned by the authenticated route. */
export function HealthView({
  data,
  isLoading,
  isFetching,
  isError,
  error,
  onRefresh,
  onAcknowledge,
  onResolve,
  busy,
}: HealthViewProps) {
  const showData = !isLoading && !isError && data;
  return (
    <div className="min-h-dvh bg-background pb-[calc(env(safe-area-inset-bottom)+7rem)] text-foreground sm:pb-16">
      <PageHeader
        eyebrow="Operação do estúdio"
        title="Saúde do sistema"
        description="Acompanhe os incidentes e a sincronização da operação."
        leading={
          <Button asChild variant="outline" size="icon" className="rounded-xl">
            <Link to="/menu" aria-label="Voltar à conta e gestão">
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        }
        actions={
          <Button variant="outline" onClick={onRefresh} className="rounded-xl">
            <RefreshCw
              className={cn("size-4", isFetching && "animate-spin motion-reduce:animate-none")}
              aria-hidden="true"
            />
            {isFetching ? "Atualizando…" : "Atualizar"}
          </Button>
        }
      />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {isLoading ? (
          <section aria-label="Carregando saúde do sistema" aria-busy="true" className="space-y-4">
            <p role="status" className="text-sm text-muted-foreground">
              Consultando a operação…
            </p>
            <Skeleton className="h-36 rounded-2xl motion-reduce:animate-none" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-28 rounded-2xl motion-reduce:animate-none" />
              ))}
            </div>
            <Skeleton className="h-48 rounded-2xl motion-reduce:animate-none" />
          </section>
        ) : isError ? (
          <section role="alert" className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <span className="mb-4 grid size-11 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </span>
            <h2 className="font-editorial text-2xl">Não foi possível carregar o painel</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Atualize a página ou tente novamente.
            </p>
            <Button onClick={onRefresh} variant="outline" className="mt-5 rounded-xl">
              Tentar novamente
            </Button>
            {error instanceof Error && error.message ? (
              <details className="mt-5 border-t border-border pt-4">
                <summary className="cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Detalhes técnicos
                </summary>
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-muted/50 p-3 text-xs leading-relaxed">
                  {error.message}
                </pre>
              </details>
            ) : null}
          </section>
        ) : showData ? (
          <>
            <section
              aria-labelledby="health-overview"
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
                <span
                  className={cn(
                    "grid size-12 shrink-0 place-items-center rounded-2xl",
                    data.degraded
                      ? "bg-warning/10 text-warning"
                      : data.level === "critico"
                        ? "bg-destructive/10 text-destructive"
                        : data.level === "atencao"
                          ? "bg-warning/10 text-warning"
                          : "bg-primary/10 text-primary",
                  )}
                >
                  {data.degraded ? (
                    <AlertTriangle className="size-6" aria-hidden="true" />
                  ) : data.level === "ok" ? (
                    <CheckCircle2 className="size-6" aria-hidden="true" />
                  ) : (
                    <Activity className="size-6" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Estado informado pelo sistema
                  </p>
                  <h2
                    id="health-overview"
                    className="break-words font-editorial text-2xl sm:text-3xl"
                  >
                    {data.degraded ? "Leitura parcial" : LEVEL_TEXT[data.level]}
                  </h2>
                </div>
                <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                  <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    Atualizado em {brusselsStamp(data.generatedAtISO)}
                    <br />
                    Horário de Bruxelas
                  </span>
                </p>
              </div>
              {data.degraded ? (
                <div
                  role="status"
                  className="flex items-start gap-2 border-t border-border bg-warning/10 px-5 py-3 text-sm text-warning sm:px-6"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p>
                    <strong>Leitura parcial.</strong> Algumas métricas não carregaram. Atualize para
                    consultar novamente.
                  </p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 border-t border-border bg-background/40 px-5 py-4 sm:px-6">
                <Button asChild variant="outline" className="rounded-xl">
                  <Link to="/reconciliar">
                    Reconciliar CRM <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="rounded-xl">
                  <Link to="/relatorios/movimentacoes">
                    Relatório de lançamentos <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </section>

            <section aria-label="Indicadores da operação">
              <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Metric
                  label="Incidentes abertos"
                  value={data.metrics.openCount}
                  icon={AlertTriangle}
                />
                <Metric label="Críticos" value={data.metrics.criticalCount} icon={ShieldAlert} />
                <Metric
                  label="Falhas de sync CRM"
                  value={data.metrics.syncFailures}
                  icon={RefreshCw}
                />
                <Metric
                  label="A reconciliar"
                  value={data.metrics.reconciliationRequired}
                  icon={Activity}
                />
                <Metric
                  label="Pagamentos sem sync"
                  value={data.metrics.movimentacoesFailed}
                  icon={Banknote}
                />
                <Metric
                  label="Check-ins sem sync"
                  value={data.metrics.checkinsFailed}
                  icon={ScanLine}
                />
              </dl>
            </section>

            <section aria-labelledby="health-incidents" className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="health-incidents" className="font-editorial text-2xl">
                  Incidentes ativos
                </h2>
                <p className="text-xs text-muted-foreground">
                  {data.incidents.length}{" "}
                  {data.incidents.length === 1 ? "registro exibido" : "registros exibidos"}
                </p>
              </div>
              {data.incidents.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                  <span
                    className={cn(
                      "mb-3 grid size-11 place-items-center rounded-xl",
                      data.degraded ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary",
                    )}
                  >
                    {data.degraded ? (
                      <AlertTriangle className="size-5" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="size-5" aria-hidden="true" />
                    )}
                  </span>
                  <h3 className="text-base font-semibold">
                    {data.degraded
                      ? "Nenhum incidente retornado nesta leitura."
                      : "Nenhum incidente ativo"}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {data.degraded
                      ? "Atualize para conferir."
                      : "Nada pendente de tratamento no momento."}
                  </p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {data.incidents.map((incident) => (
                    <IncidentCard
                      key={incident.id}
                      incident={incident}
                      busy={busy}
                      onAck={() => onAcknowledge(incident.id)}
                      onResolve={() => onResolve(incident.id)}
                    />
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <dt className="min-w-0 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {label}
        </dt>
        <Icon className="size-4 shrink-0 text-primary/70" aria-hidden="true" />
      </div>
      <dd className="mt-3 font-editorial text-3xl tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function IncidentCard({
  incident,
  onAck,
  onResolve,
  busy,
}: {
  incident: Incident;
  onAck: () => void;
  onResolve: () => void;
  busy: boolean;
}) {
  const contextEntries = Object.entries(incident.safeContext);
  return (
    <li className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <article
        aria-label={`${SOURCE_LABEL[incident.source]} — ${SEVERITY_LABEL[incident.severity]}`}
      >
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold">{SOURCE_LABEL[incident.source]}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
                  incident.severity === "critica"
                    ? "bg-destructive/10 text-destructive"
                    : incident.severity === "alta"
                      ? "bg-warning/10 text-warning"
                      : "bg-muted text-muted-foreground",
                )}
              >
                <AlertTriangle className="size-3.5" aria-hidden="true" />
                {SEVERITY_LABEL[incident.severity]}
              </span>
              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-muted-foreground">
                {STATUS_TEXT[incident.status]}
              </span>
            </div>
          </div>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
            {incident.message}
          </p>
          <dl className="mt-5 grid grid-cols-1 gap-3 text-xs min-[480px]:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Ocorrências</dt>
              <dd className="mt-1 font-medium tabular-nums">{incident.occurrences}×</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Primeiro registro</dt>
              <dd className="mt-1 font-medium tabular-nums">
                {brusselsStamp(incident.firstSeenAt)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Último registro</dt>
              <dd className="mt-1 font-medium tabular-nums">
                {brusselsStamp(incident.lastSeenAt)}
              </dd>
            </div>
          </dl>
          {incident.status === "acknowledged" ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Reconhecido em {brusselsStamp(incident.acknowledgedAt ?? incident.lastSeenAt)}
            </p>
          ) : null}
          <details className="group mt-5 border-t border-border pt-4">
            <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 rounded-sm text-sm font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              Detalhes técnicos
              <ChevronDown
                className="size-4 shrink-0 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </summary>
            <dl className="mt-3 space-y-3 rounded-xl bg-background p-4 text-xs">
              <div>
                <dt className="text-muted-foreground">Tipo</dt>
                <dd className="mt-1 whitespace-pre-wrap break-all font-mono">{incident.kind}</dd>
              </div>
              {contextEntries.map(([key, value]) => (
                <div key={key}>
                  <dt className="break-all text-muted-foreground">{key}</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-all font-mono">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border bg-background/40 px-5 py-4 sm:px-6">
          {incident.status === "open" ? (
            <Button
              variant="outline"
              className="min-h-11 rounded-xl"
              disabled={busy}
              onClick={onAck}
            >
              <Eye className="size-4" aria-hidden="true" />
              Reconhecer
            </Button>
          ) : null}
          <Button className="min-h-11 rounded-xl" disabled={busy} onClick={onResolve}>
            <Check className="size-4" aria-hidden="true" />
            Resolver
          </Button>
        </div>
      </article>
    </li>
  );
}
