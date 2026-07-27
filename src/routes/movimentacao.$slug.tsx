import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock } from "lucide-react";
import { getSlugContext, listArtistsForSelect } from "@/lib/movimentacao.functions";
import { MovimentacaoForm } from "@/components/movimentacao/movimentacao-form";
import { isMovimentacaoSlug } from "@/config/movimentacao-slugs";

export const Route = createFileRoute("/movimentacao/$slug")({
  head: () => ({
    meta: [
      { title: "Registrar pagamento — GF Tattoo Studio" },
      { name: "description", content: "Registro rápido de pagamentos do estúdio." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MovimentacaoPublicPage,
});

function MovimentacaoPublicPage() {
  const { slug } = Route.useParams();
  const fetchContext = useServerFn(getSlugContext);
  const fetchArtists = useServerFn(listArtistsForSelect);

  const validSlug = isMovimentacaoSlug(slug);

  const ctx = useQuery({
    queryKey: ["movimentacao-slug-context", slug],
    queryFn: () => fetchContext({ data: { slug } }),
    enabled: validSlug,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const artists = useQuery({
    queryKey: ["movimentacao-artists"],
    queryFn: () => fetchArtists(),
    staleTime: 5 * 60_000,
    enabled: !!ctx.data,
  });

  if (!validSlug) {
    return (
      <div className="min-h-svh bg-background p-6 text-sm text-muted-foreground">
        Link inválido.
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background pb-[calc(env(safe-area-inset-bottom)+7rem)] text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-sm font-bold uppercase tracking-wider">
              Registro de pagamento
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {ctx.data?.recebidoPorNome ?? "…"}
            </p>
          </div>
          <a
            href="/movimentacao/historico"
            className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Clock className="h-3.5 w-3.5" />
            Histórico
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        {ctx.isLoading && (
          <div className="text-sm text-muted-foreground">A carregar…</div>
        )}
        {ctx.error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {ctx.error instanceof Error ? ctx.error.message : "Erro ao carregar."}
          </div>
        )}
        {ctx.data && (
          <MovimentacaoForm
            context={ctx.data}
            artists={artists.data ?? []}
            artistsLoading={artists.isLoading}
          />
        )}
      </main>
    </div>
  );
}