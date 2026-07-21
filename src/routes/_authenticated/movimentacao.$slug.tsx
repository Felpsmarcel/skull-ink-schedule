import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSlugContext, listArtistsForSelect, getMySlug } from "@/lib/movimentacao.functions";
import { MovimentacaoForm } from "@/components/movimentacao/movimentacao-form";
import { Toaster } from "@/components/ui/sonner";
import { ChevronLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { isMovimentacaoSlug } from "@/config/movimentacao-slugs";

export const Route = createFileRoute("/_authenticated/movimentacao/$slug")({
  head: () => ({
    meta: [
      { title: "Registrar pagamento — GF Tattoo Studio" },
      { name: "description", content: "Registro rápido de pagamentos do estúdio." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MovimentacaoPage,
});

function MovimentacaoPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const fetchContext = useServerFn(getSlugContext);
  const fetchArtists = useServerFn(listArtistsForSelect);
  const fetchMySlug = useServerFn(getMySlug);

  const validSlug = isMovimentacaoSlug(slug);

  const ctx = useQuery({
    queryKey: ["movimentacao-slug-context", slug],
    queryFn: () => fetchContext({ data: { slug } }),
    enabled: validSlug,
    retry: false,
  });

  const artists = useQuery({
    queryKey: ["movimentacao-artists"],
    queryFn: () => fetchArtists(),
    staleTime: 5 * 60_000,
    enabled: !!ctx.data,
  });

  // Se acessou um slug que não é dele nem é admin → redireciona para o próprio.
  useEffect(() => {
    if (!ctx.error) return;
    const msg = ctx.error instanceof Error ? ctx.error.message : "";
    if (!msg.includes("forbidden_slug")) return;
    void fetchMySlug().then((res) => {
      if (res.slug && res.slug !== slug) {
        navigate({ to: "/movimentacao/$slug", params: { slug: res.slug }, replace: true });
      } else {
        navigate({ to: "/agenda", replace: true });
      }
    });
  }, [ctx.error, fetchMySlug, navigate, slug]);

  if (!validSlug) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Link inválido.{" "}
        <Link to="/agenda" className="underline">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background pb-[calc(env(safe-area-inset-bottom)+6rem)] text-foreground">
      <Toaster
        position="top-center"
        offset="calc(env(safe-area-inset-top) + 0.5rem)"
        mobileOffset="calc(env(safe-area-inset-top) + 0.5rem)"
      />
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <Link
          to="/menu"
          className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold uppercase tracking-wider">
            Registro de pagamento
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {ctx.data?.recebidoPorNome ?? "…"}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-4">
        {ctx.isLoading && (
          <div className="text-sm text-muted-foreground">A carregar…</div>
        )}
        {ctx.error && !String(ctx.error).includes("forbidden_slug") && (
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
      </div>
    </div>
  );
}