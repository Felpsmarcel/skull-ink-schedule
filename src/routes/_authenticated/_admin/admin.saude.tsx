import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { HealthView } from "@/components/health/health-view";
import {
  acknowledgeIncident,
  getOperationalHealth,
  resolveIncident,
} from "@/lib/observability.functions";
import type { OperationalHealth } from "@/lib/observability";

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
    <HealthView
      data={data}
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      error={error}
      onRefresh={() => void refetch()}
      onAcknowledge={(id) => ackMutation.mutate({ data: { id } })}
      onResolve={(id) => resolveMutation.mutate({ data: { id } })}
      busy={ackMutation.isPending || resolveMutation.isPending}
    />
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
