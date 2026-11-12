import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { QueuePageView } from "@/components/checkin/queue-view";
import { useQueryClient } from "@tanstack/react-query";
import { FilaAguardando, useFilaHoje } from "@/components/checkin/fila-aguardando";

export const Route = createFileRoute("/_authenticated/_admin/admin/fila")({
  head: () => ({
    meta: [
      { title: "Fila do dia — GF Tattoo Studio" },
      { name: "description", content: "Check-ins e fila de atendimento do dia." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: FilaAdminPage,
});

function FilaAdminPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading, error, isFetching } = useFilaHoje();
  const total = isLoading || error || !data ? null : data.length;

  return (
    <QueuePageView
      count={total}
      refreshing={isFetching}
      onBack={() => navigate({ to: "/home" })}
      onRefresh={() => {
        void qc.invalidateQueries({ queryKey: ["fila-hoje"] });
        void qc.invalidateQueries({ queryKey: ["home-dashboard"] });
      }}
    >
      <FilaAguardando showConcluidos />
    </QueuePageView>
  );
}
