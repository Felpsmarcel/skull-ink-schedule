import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGhlSyncStatus } from "@/lib/ghl-sync-admin.functions";
import { syncFreshness } from "@/lib/sync-core";

export function GhlSyncStatus() {
  const status = useServerFn(getGhlSyncStatus);
  const q = useQuery({
    queryKey: ["ghl-sync-status"],
    queryFn: () => status(),
    refetchInterval: 60_000,
  });
  const last = q.data?.last_success_at ?? null;
  const state = syncFreshness(last, q.data?.latest_status);
  const labels = {
    current: "Atualizado",
    stale: "Desatualizado",
    failed: "Falha na atualização",
    running: "Sincronizando",
  };
  return (
    <p role="status" className="text-xs text-muted-foreground">
      {q.isPending
        ? "Verificando atualização…"
        : q.isError
          ? "Não foi possível verificar atualização"
          : labels[state]}
      {last
        ? ` · Última conclusão: ${new Date(last).toLocaleString("pt-PT")}`
        : " · Última conclusão não verificada"}
    </p>
  );
}
