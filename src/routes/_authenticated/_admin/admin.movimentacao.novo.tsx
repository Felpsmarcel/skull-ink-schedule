import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Receipt } from "lucide-react";
import { MovimentacaoForm } from "@/components/movimentacao/movimentacao-form";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { useArtists } from "@/hooks/use-artists";

export const Route = createFileRoute("/_authenticated/_admin/admin/movimentacao/novo")({
  head: () => ({
    meta: [
      { title: "Novo lançamento manual — GF Tattoo Studio" },
      {
        name: "description",
        content: "Registar manualmente um pagamento recebido fora do link do tatuador.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MovimentacaoNovoPage,
});

function MovimentacaoNovoPage() {
  const { data: artists, isLoading, isError, error, refetch } = useArtists();

  return (
    <div className="min-h-svh bg-background pb-[calc(env(safe-area-inset-bottom)+7rem)] text-foreground sm:pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <Link
          to="/relatorios/movimentacoes"
          className="rounded-md p-2 hover:bg-muted"
          aria-label="Voltar ao relatório"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="flex-1 text-base font-bold uppercase tracking-wider">
          Novo lançamento manual
        </h1>
        <Link
          to="/relatorios/movimentacoes"
          search={{ origem: "manual" }}
          className="rounded-md p-2 hover:bg-muted"
          aria-label="Ver lançamentos manuais"
        >
          <Receipt className="h-4 w-4" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-4">
        <p className="mb-4 text-sm text-muted-foreground">
          Use este formulário para registar pagamentos recebidos fora do link público do
          tatuador. O registo ficará marcado como origem "Lançamento manual".
        </p>

        {isLoading ? (
          <LoadingState label="A carregar tatuadores…" />
        ) : isError ? (
          <ErrorState
            description={error instanceof Error ? error.message : "Falha ao carregar tatuadores"}
            onRetry={() => { void refetch(); }}
          />
        ) : (
          <MovimentacaoForm mode="manual" artists={artists ?? []} artistsLoading={isLoading} />
        )}
      </main>
    </div>
  );
}
