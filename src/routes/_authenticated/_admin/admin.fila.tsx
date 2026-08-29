import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
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
  const { data } = useFilaHoje();
  const total = data?.length ?? 0;

  return (
    <div className="min-h-svh bg-background pb-[calc(env(safe-area-inset-bottom)+7rem)] text-foreground sm:pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <Link to="/home" className="rounded-md p-2 hover:bg-muted" aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="flex-1 text-base font-bold uppercase tracking-wider">Fila do dia</h1>
        <button
          type="button"
          onClick={() => {
            void qc.invalidateQueries({ queryKey: ["fila-hoje"] });
            void qc.invalidateQueries({ queryKey: ["home-dashboard"] });
          }}
          className="rounded-md p-2 hover:bg-muted"
          aria-label="Atualizar"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4 sm:max-w-3xl">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {total} check-in{total === 1 ? "" : "s"} hoje
        </p>
        <FilaAguardando showConcluidos />
      </div>
    </div>
  );
}
