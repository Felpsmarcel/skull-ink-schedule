import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  AlertTriangle,
  Check,
  ChevronDown,
  Inbox,
  Calendar,
  Hash,
  Lightbulb,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  listOpenSyncFailures,
  resolveSyncFailure,
  type SyncFailureRow,
} from "@/lib/sync.functions";
import { SyncGhlButton } from "@/components/sync-ghl-button";
import { backfillGhlContactNames } from "@/lib/ghl-sync-admin.functions";

export const Route = createFileRoute("/_authenticated/_admin/reconciliar")({
  head: () => ({
    meta: [
      { title: "Reconciliar GHL — GF Tattoo Studio" },
      { name: "description", content: "Reconciliação de sincronizações com o GHL." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ReconciliarPage,
});

function recommendedAction(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes("calendar") || r.includes("calendário") || r.includes("artist"))
    return "Confirme se o calendário do GHL está vinculado a um artista no app.";
  if (r.includes("contact") || r.includes("contato") || r.includes("contacto"))
    return "Verifique se o contacto existe no GHL e tem nome/telefone válidos.";
  if (r.includes("duplicate") || r.includes("duplicad") || r.includes("unique"))
    return "Já existe um registo com este ID. Pode marcar como resolvido.";
  if (r.includes("invalid") || r.includes("parse") || r.includes("schema"))
    return "Payload do GHL veio em formato inesperado. Reveja o evento no GHL.";
  if (r.includes("network") || r.includes("timeout") || r.includes("fetch"))
    return "Falha de rede com o GHL. Tente Sincronizar agora novamente.";
  return "Reveja o evento no GHL e, se já estiver correto, marque como reconciliado.";
}

function ReconciliarPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listOpenSyncFailures);
  const resolve = useServerFn(resolveSyncFailure);
  const backfill = useServerFn(backfillGhlContactNames);

  const backfillM = useMutation({
    mutationFn: () => backfill({ data: undefined }),
    onSuccess: (r) => {
      if (r.updatedAppointments === 0) {
        toast.info(
          r.scanned === 0
            ? "Todos os agendamentos já têm nome de cliente."
            : `Nenhum nome encontrado no GHL (${r.notFound} contacto(s) sem nome).`,
        );
      } else {
        toast.success(
          `${r.updatedAppointments} agendamento(s) e ${r.updatedContacts} contacto(s) atualizados.`,
        );
      }
      qc.invalidateQueries({ queryKey: ["monthly-report"] });
      qc.invalidateQueries({ queryKey: ["agenda-range"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const failuresQ = useQuery<SyncFailureRow[]>({
    queryKey: ["sync-failures"],
    queryFn: () => list(),
  });

  const resolveM = useMutation({
    mutationFn: (id: string) => resolve({ data: { id } }),
    onSuccess: () => {
      toast.success("Marcado como reconciliado.");
      qc.invalidateQueries({ queryKey: ["sync-failures"] });
    },
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
        <SyncGhlButton>Sincronizar agora</SyncGhlButton>
      </header>

      <main className="flex-1 space-y-3 p-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4" /> Nomes de clientes
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Preenche nome, telefone e email dos clientes nos agendamentos antigos
                importados do GHL (até 500 por execução).
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={backfillM.isPending}
              onClick={() => backfillM.mutate()}
            >
              {backfillM.isPending ? "A preencher..." : "Preencher nomes"}
            </Button>
          </div>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Como funciona</AlertTitle>
          <AlertDescription>
            Eventos do GHL que falharam ao espelhar no banco. Marcar como{" "}
            <strong>Resolvido</strong> apenas regista que foi reconciliado — não
            reprocessa o evento automaticamente. Para reprocessar, use{" "}
            <em>Sincronizar agora</em>.
          </AlertDescription>
        </Alert>

        {failuresQ.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : failuresQ.error ? (
          <ErrorState
            title="Não foi possível carregar as falhas"
            description="Verifique a conexão e tente novamente."
            details={(failuresQ.error as Error).message}
            onRetry={() => failuresQ.refetch()}
          />
        ) : (failuresQ.data ?? []).length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="Nenhuma falha em aberto"
            description="Tudo sincronizado com o GHL."
          />
        ) : (
          <ul className="space-y-3">
            {(failuresQ.data ?? []).map((f) => (
              <FailureCard
                key={f.id}
                failure={f}
                onResolve={() => resolveM.mutate(f.id)}
                isResolving={resolveM.isPending}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function FailureCard({
  failure,
  onResolve,
  isResolving,
}: {
  failure: SyncFailureRow;
  onResolve: () => void;
  isResolving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const action = recommendedAction(failure.reason);

  return (
    <li className="rounded-lg border border-border bg-card p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start gap-2">
            <StatusBadge variant="warning" className="mt-0.5 shrink-0">
              Pendente
            </StatusBadge>
            <div className="font-medium leading-snug">{failure.reason}</div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(failure.created_at).toLocaleString("pt-PT")}
            </span>
            {failure.ghl_event_id ? (
              <span className="inline-flex items-center gap-1 font-mono">
                <Hash className="h-3 w-3" />
                {failure.ghl_event_id}
              </span>
            ) : (
              <span className="italic">sem event id</span>
            )}
          </div>
          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2 text-xs">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-medium">Ação recomendada: </span>
              {action}
            </span>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={isResolving}>
              <Check className="mr-1 h-3.5 w-3.5" /> Resolvido
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Marcar como reconciliado?</AlertDialogTitle>
              <AlertDialogDescription>
                Isto apenas marca esta falha como tratada. <strong>Não
                reprocessa</strong> o evento no banco nem altera nada no GHL.
                Para reimportar, use “Sincronizar agora”.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onResolve}>
                Marcar como resolvido
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {failure.payload ? (
        <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
              />
              Ver detalhes técnicos
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/50 p-2 text-[10px]">
              {failure.payload}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </li>
  );
}