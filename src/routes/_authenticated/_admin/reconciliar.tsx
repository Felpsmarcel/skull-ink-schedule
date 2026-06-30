import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, AlertTriangle, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  listOpenSyncFailures,
  resolveSyncFailure,
  runGhlSync,
  type SyncFailureRow,
} from "@/lib/sync.functions";

export const Route = createFileRoute("/_authenticated/_admin/reconciliar")({
  head: () => ({ meta: [{ title: "Reconciliar GHL — GF Tattoo Studio" }] }),
  component: ReconciliarPage,
});

function ReconciliarPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listOpenSyncFailures);
  const sync = useServerFn(runGhlSync);
  const resolve = useServerFn(resolveSyncFailure);

  const failuresQ = useQuery<SyncFailureRow[]>({
    queryKey: ["sync-failures"],
    queryFn: () => list(),
  });

  const syncM = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r) => {
      toast.success(
        `Sync ok · ${r.inserted} novos · ${r.updated} atualizados · ${r.failures} falhas`,
      );
      qc.invalidateQueries({ queryKey: ["sync-failures"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const resolveM = useMutation({
    mutationFn: (id: string) => resolve({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sync-failures"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-20">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate({ to: "/financeiro" })}
            className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="h-4 w-4" /> Reconciliar GHL
          </h1>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => syncM.mutate()}
          disabled={syncM.isPending}
        >
          <RefreshCw
            className={`mr-2 h-3.5 w-3.5 ${syncM.isPending ? "animate-spin" : ""}`}
          />
          Sincronizar agora
        </Button>
      </header>

      <main className="flex-1 space-y-3 p-4">
        <p className="text-xs text-muted-foreground">
          Eventos do GHL que falharam ao espelhar no banco. Resolva no GHL ou no banco,
          depois marque como reconciliado.
        </p>
        {failuresQ.isLoading ? (
          <p className="text-sm text-muted-foreground">A carregar…</p>
        ) : failuresQ.error ? (
          <p className="text-sm text-destructive">
            {(failuresQ.error as Error).message}
          </p>
        ) : (failuresQ.data ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Sem falhas em aberto.
          </div>
        ) : (
          <ul className="space-y-2">
            {(failuresQ.data ?? []).map((f) => (
              <li
                key={f.id}
                className="rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{f.reason}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(f.created_at).toLocaleString("pt-PT")} ·{" "}
                      {f.ghl_event_id ? `event ${f.ghl_event_id}` : "sem event id"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resolveM.mutate(f.id)}
                    disabled={resolveM.isPending}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" /> Resolvido
                  </Button>
                </div>
                {f.payload ? (
                  <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-[10px]">
                    {JSON.stringify(f.payload, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}