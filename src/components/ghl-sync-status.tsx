import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGhlSyncStatus } from "@/lib/ghl-sync-admin.functions";
import { syncFreshness } from "@/lib/sync-core";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  const label = q.isPending
    ? "Verificando atualização…"
    : q.isError
      ? "Não foi possível verificar atualização"
      : labels[state];
  const tone = q.isPending
    ? "bg-muted-foreground"
    : q.isError || state === "failed"
      ? "bg-destructive"
      : state === "current"
        ? "bg-success"
        : state === "running"
          ? "bg-primary"
          : "bg-warning";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label={`Atualização do CRM: ${label}. Abrir detalhes`}
          title={`CRM: ${label}`}
        >
          <span aria-hidden="true" className={cn("size-2.5 rounded-full", tone)} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-w-[calc(100vw-2rem)] space-y-2 motion-reduce:animate-none">
        <h2 className="text-sm font-semibold">Atualização do CRM</h2>
        <p role="status" aria-live="polite" aria-atomic="true" className="flex items-center gap-2 text-sm">
          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", tone)} />
          {label}
        </p>
        <p className="text-sm text-muted-foreground">
          {last
            ? `Última conclusão: ${new Date(last).toLocaleString("pt-PT", { timeZone: "Europe/Brussels" })} (Bruxelas)`
            : "Última conclusão não verificada"}
        </p>
      </PopoverContent>
    </Popover>
  );
}
