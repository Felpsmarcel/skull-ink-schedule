import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Receipt } from "lucide-react";
import { MovimentacaoForm } from "@/components/movimentacao/movimentacao-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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
      <PageHeader
        title="Novo lançamento manual"
        description="Registre um pagamento recebido fora do link do tatuador."
        leading={
          <Button asChild variant="outline" size="icon" className="min-h-11 min-w-11 rounded-xl">
            <Link to="/relatorios/movimentacoes" aria-label="Voltar ao relatório">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        }
        actions={
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <Link to="/relatorios/movimentacoes" search={{ origem: "manual" }}>
              <Receipt className="h-4 w-4" /> Ver lançamentos manuais
            </Link>
          </Button>
        }
      />

      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
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
