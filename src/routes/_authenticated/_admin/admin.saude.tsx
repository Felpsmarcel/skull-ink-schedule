import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Activity, AlertTriangle, Check, Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import {
  acknowledgeIncident,
  getOperationalHealth,
  resolveIncident,
} from "@/lib/observability.functions";
import {
  SEVERITY_LABEL,
  SOURCE_LABEL,
  brusselsStamp,
  type HealthLevel,
  type Incident,
  type OperationalHealth,
} from "@/lib/observability";

export const Route = createFileRoute("/_authenticated/_admin/admin/saude")({
  head: () => ({
    meta: [
      { title: "Saúde do sistema — GF Tattoo Studio" },
      {
        name: "description",
        content: "Painel administrativo de incidentes e confiabilidade da operação.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SaudePage,
});

const LEVEL_TEXT: Record<HealthLevel, string> = {
  ok: "Operação saudável",
  atencao: "Requer atenção",
  critico: "Falha crítica ativa",
};

function SaudePage() {
  const fetchHealth = useServerFn(getOperationalHealth);
  const ack = useServerFn(acknowledgeIncident);
  const resolve = useServerFn(resolveIncident);
  const qc = useQueryClient();

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<OperationalHealth>({
    queryKey: ["operational-health"],
    queryFn: () => fetchHealth(),
    refetchInterval: 120_000,
    retry: false,
  });

  const ackMutation = useIncidentMutation(ack, "Incidente reconhecido", qc);
  const resolveMutation = useIncidentMutation(resolve, "Incidente resolvido", qc);

  return (
    <div className="min-h-svh bg-background pb-[calc(env(safe-area-inset-bottom)+7rem)] text-foreground sm:pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <Button asChild variant="ghost" size="icon" className="h-9 w-9">
          <Link to="/menu" aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="flex-1 text-base font-bold uppercase tracking-wider">Saúde do sistema</h1>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Atualizar"
          onClick={() => void refetch()}
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4 sm:max-w-3xl">
        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : isError ? (
          <ErrorState
            title="Não foi possível carregar o painel"
            description="Atualize a página ou tente novamente."
            details={error instanceof Error ? error.message : undefined}
            onRetry={() => { void refetch(); }}
          />
        ) : data ? (
          <>
            <section
              className={cn(
                "rounded-lg border p-4",
                data.level === "critico"
                  ? "border-destructive bg-destructive/10"
                  : data.level === "atencao"
                    ? "border-border bg-card"
                    : "border-border bg-card",
              )}
            >
              <div className="flex items-center gap-2">
                <Activity
                  className={cn(
                    "h-5 w-5",
                    data.level === "critico" ? "text-destructive" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                <p className="flex-1 text-sm font-bold uppercase tracking-wider">
                  {LEVEL_TEXT[data.level]}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Atualizado às {brusselsStamp(data.generatedAtISO)} (Bruxelas)
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <Metric label="Incidentes abertos" value={data.metrics.openCount} />
                <Metric label="Críticos" value={data.metrics.criticalCount} />
                <Metric label="Falhas de sync CRM" value={data.metrics.syncFailures} />
                <Metric label="A reconciliar" value={data.metrics.reconciliationRequired} />
                <Metric label="Pagamentos sem sync" value={data.metrics.movimentacoesFailed} />
                <Metric label="Check-ins sem sync" value={data.metrics.checkinsFailed} />
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/reconciliar">Reconciliar CRM</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/relatorios/movimentacoes">Relatório de lançamentos</Link>
                </Button>
              </div>
            </section>

            <section>
              <h2 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Incidentes ativos
              </h2>
              {data.incidents.length === 0 ? (
                <EmptyState
                  title="Nenhum incidente ativo"
                  description="Nada pendente de tratamento no momento."
                />
              ) : (
                <ul className="space-y-3">
                  {data.incidents.map((incident) => (
                    <IncidentCard
                      key={incident.id}
                      incident={incident}
                      onAck={() => ackMutation.mutate({ data: { id: incident.id } })}
                      onResolve={() => resolveMutation.mutate({ data: { id: incident.id } })}
                      busy={ackMutation.isPending || resolveMutation.isPending}
                    />
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function useIncidentMutation(
  fn: (args: { data: { id: string } }) => Promise<unknown>,
  label: string,
  qc: ReturnType<typeof useQueryClient>,
) {
  return useMutation({
    mutationFn: (args: { data: { id: string } }) => fn(args),
    onSuccess: () => {
      toast.success(label);
      void qc.invalidateQueries({ queryKey: ["operational-health"] });
      void qc.invalidateQueries({ queryKey: ["home-dashboard"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
    },
  });
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-lg font-bold tabular-nums">{value}</dd>
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
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            incident.severity === "critica" ? "text-destructive" : "text-muted-foreground",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {SEVERITY_LABEL[incident.severity]} · {SOURCE_LABEL[incident.source]} · {incident.kind}
          </p>
          <p className="mt-1 break-words text-sm">{incident.message}</p>
          <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
            {incident.occurrences}× · primeiro {brusselsStamp(incident.firstSeenAt)} · último{" "}
            {brusselsStamp(incident.lastSeenAt)}
          </p>
          {contextEntries.length > 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {contextEntries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
            </p>
          ) : null}
          {incident.status === "acknowledged" ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Reconhecido em {brusselsStamp(incident.acknowledgedAt ?? incident.lastSeenAt)}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {incident.status === "open" ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={onAck}>
            <Eye className="mr-1 h-3.5 w-3.5" /> Reconhecer
          </Button>
        ) : null}
        <Button size="sm" disabled={busy} onClick={onResolve}>
          <Check className="mr-1 h-3.5 w-3.5" /> Resolver
        </Button>
      </div>
    </li>
  );
}
