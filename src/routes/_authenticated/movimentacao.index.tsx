import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMySlug } from "@/lib/movimentacao.functions";

export const Route = createFileRoute("/_authenticated/movimentacao/")({
  head: () => ({
    meta: [
      { title: "Registrar pagamento — GF Tattoo Studio" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MovimentacaoIndex,
});

function MovimentacaoIndex() {
  const navigate = useNavigate();
  const fetchSlug = useServerFn(getMySlug);
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-movimentacao-slug"],
    queryFn: () => fetchSlug(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data?.slug) {
      navigate({ to: "/movimentacao/$slug", params: { slug: data.slug }, replace: true });
    }
  }, [data?.slug, navigate]);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">A carregar…</div>;
  }
  if (error || data?.slug === null) {
    return (
      <div className="mx-auto max-w-md p-6 text-sm">
        <h1 className="mb-2 text-base font-semibold">Sem link de registro</h1>
        <p className="text-muted-foreground">
          Sua conta ainda não está vinculada a nenhum tatuador ou vendedor.
          Peça a um administrador para configurar o vínculo.
        </p>
      </div>
    );
  }
  return null;
}