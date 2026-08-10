import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Clock, Loader2, PlayCircle, UserX, CheckCheck } from "lucide-react";
import {
  getFilaHoje,
  setCheckinStatus,
  type CheckinStatus,
  type FilaRow,
} from "@/lib/checkin.functions";
import { haptic } from "@/lib/haptics";

function hora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Brussels",
  });
}

function esperaMin(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

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
  const { data, isLoading, error } = useFilaHoje();
  const qc = useQueryClient();
  const updateStatus = useServerFn(setCheckinStatus);

  const mutation = useMutation({
    mutationFn: (vars: { id: string; status: CheckinStatus }) => updateStatus({ data: vars }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fila-hoje"] });
      toast.success("Fila atualizada");
    },
    onError: () => toast.error("Não foi possível atualizar a fila"),
  });

  const rows = (data ?? []).filter((r) =>
    showConcluidos ? true : r.status === "aguardando" || r.status === "em_atendimento",
  );

  if (isLoading) {
    return (
      <div className="grid place-items-center rounded-lg border border-border bg-card py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Não foi possível carregar a fila agora.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Ninguém aguardando neste momento.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className="rounded-lg border border-border bg-card p-3"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{r.clienteNome}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wider">
                  {r.codigo}
                </span>
                {r.syncStatus === "failed" ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" title="Sync CRM falhou" />
                ) : null}
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                chegou {hora(r.arrivedAtISO)} · espera {esperaMin(r.arrivedAtISO)} min
                {r.scheduledAtISO ? ` · agendado ${hora(r.scheduledAtISO)}` : ""}
                {r.tatuador ? ` · ${r.tatuador}` : ""}
              </p>
            </div>

            <div className="flex shrink-0 gap-1.5">
              {r.status === "aguardando" ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      haptic("tap");
                      mutation.mutate({ id: r.id, status: "em_atendimento" });
                    }}
                    disabled={mutation.isPending}
                    className="flex h-11 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Iniciar
                  </button>
                  <button
                    type="button"
                    onClick={() => mutation.mutate({ id: r.id, status: "nao_compareceu" })}
                    disabled={mutation.isPending}
                    className="grid h-11 w-11 place-items-center rounded-md border border-border text-muted-foreground disabled:opacity-50"
                    aria-label="Não compareceu"
                  >
                    <UserX className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => mutation.mutate({ id: r.id, status: "concluido" })}
                  disabled={mutation.isPending}
                  className="flex h-11 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  <CheckCheck className="h-4 w-4" />
                  Concluir
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
