import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMySlug } from "@/lib/movimentacao.functions";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/movimentacao/")({
  head: () => ({
    meta: [
      { title: "Registrar recebimento — GF Tattoo Studio" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MovimentacaoIndex,
});

function MovimentacaoIndex() {
  const navigate = useNavigate();
  const fetchSlug = useServerFn(getMySlug);
  const profile = useCurrentUser();
  const me = profile.data;
  const personalRole = me?.role === "artist" || me?.role === "seller";
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["my-movimentacao-slug", me?.userId, me?.role, me?.artistId, me?.sellerId],
    queryFn: () => fetchSlug(),
    enabled: Boolean(me?.userId && personalRole && !profile.isPending && !profile.isError),
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    // An identity/query error takes precedence over any cached slug or role.
    if (profile.isPending || profile.isError || !me?.userId) return;
    if (me.role === "admin") {
      void navigate({ to: "/admin/movimentacao/novo", replace: true });
    } else if (personalRole && !isPending && !isError && data?.slug) {
      void navigate({ to: "/movimentacao/$slug", params: { slug: data.slug }, replace: true });
    }
  }, [
    me?.userId,
    me?.role,
    profile.isPending,
    profile.isError,
    personalRole,
    isPending,
    isError,
    data?.slug,
    navigate,
  ]);

  if (profile.isError || (personalRole && isError)) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-6 text-sm">
        <h1 className="text-base font-semibold">Não foi possível abrir o registro</h1>
        <p role="alert" className="text-muted-foreground">
          Não conseguimos confirmar o acesso desta conta. Tente novamente.
        </p>
        <button
          type="button"
          onClick={() => void (profile.isError ? profile.refetch() : refetch())}
          className="min-h-11 rounded-xl border border-border px-4 py-2 font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Tentar novamente
        </button>
      </div>
    );
  }
  if (profile.isPending || me?.role === "admin" || (personalRole && (isPending || data?.slug))) {
    return (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        Abrindo o registro de recebimentos…
      </p>
    );
  }
  return (
    <div className="mx-auto max-w-md space-y-2 p-6 text-sm">
      <h1 className="text-base font-semibold">Sem link de registro</h1>
      <p className="text-muted-foreground">
        Nenhum link pessoal está disponível para esta conta. Peça à administração para conferir seu
        acesso e vínculo na equipe.
      </p>
    </div>
  );
}
