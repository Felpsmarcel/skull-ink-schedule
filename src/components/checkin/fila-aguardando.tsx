import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { QueueView } from "@/components/checkin/queue-view";
import {
  getFilaHoje,
  setCheckinStatus,
  type CheckinStatus,
  type FilaRow,
} from "@/lib/checkin.functions";
import { haptic } from "@/lib/haptics";
import { useCurrentUser } from "@/hooks/use-current-user";

export function useFilaHoje() {
  const fetchFila = useServerFn(getFilaHoje);
  return useQuery<FilaRow[]>({
    queryKey: ["fila-hoje"],
    queryFn: () => fetchFila(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function FilaAguardando({ showConcluidos = false }: { showConcluidos?: boolean }) {
  const { data, isLoading, error, refetch } = useFilaHoje();
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  // Queue operation stays reception-only until artist RLS and row scopes are separately validated.
  const podeAgir = () => me?.role === "admin";
  const updateStatus = useServerFn(setCheckinStatus);

  const mutation = useMutation({
    mutationFn: (vars: { id: string; status: CheckinStatus }) => updateStatus({ data: vars }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fila-hoje"] });
      void qc.invalidateQueries({ queryKey: ["home-dashboard"] });
      toast.success("Fila atualizada");
    },
    onError: () => toast.error("Não foi possível atualizar a fila"),
  });

  const rows = (data ?? []).filter((r) =>
    showConcluidos ? true : r.status === "aguardando" || r.status === "em_atendimento",
  );

  return (
    <QueueView
      rows={rows}
      loading={isLoading}
      error={Boolean(error)}
      showAll={showConcluidos}
      pending={mutation.isPending}
      canAct={podeAgir}
      onRetry={() => void refetch()}
      onStatusChange={(row, status) => {
        if (status === "em_atendimento") haptic("tap");
        mutation.mutate({ id: row.id, status });
      }}
    />
  );
}
