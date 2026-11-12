import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getMySlug } from "@/lib/movimentacao.functions";
import { getMovimentacaoLinkAddress } from "@/lib/my-movimentacao-link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PaymentLinkCardView, type PaymentLinkCardState } from "./payment-link-card-view";

export function PaymentLinkCard() {
  const fetchSlug = useServerFn(getMySlug);
  const profile = useCurrentUser();
  const me = profile.data;
  const knownRole = me?.role === "admin" || me?.role === "artist" || me?.role === "seller";
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["my-movimentacao-slug", me?.userId, me?.role, me?.artistId, me?.sellerId],
    queryFn: () => fetchSlug(),
    enabled: Boolean(me?.userId && knownRole && !profile.isError),
    staleTime: 60_000,
    retry: false,
  });

  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const address = data?.slug ? getMovimentacaoLinkAddress(data.slug, origin) : null;
  let state: PaymentLinkCardState;
  if (profile.isError || (knownRole && isError)) state = { kind: "error" };
  else if (profile.isPending) state = { kind: "loading" };
  else if (!knownRole) state = { kind: "no_link" };
  else if (isPending || (data?.slug && !origin)) state = { kind: "loading" };
  else if (!data?.slug) state = { kind: "no_link" };
  else if (!address) state = { kind: "error" };
  else state = { kind: "ready", displayName: data.displayName, address };

  async function handleCopy() {
    if (state.kind !== "ready") return;
    try {
      await navigator.clipboard.writeText(state.address.url);
      toast.success(state.address.isTest ? "Link da prévia copiado" : "Link do formulário copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <PaymentLinkCardView
      state={state}
      onCopy={handleCopy}
      onRetry={() => void (profile.isError ? profile.refetch() : refetch())}
    />
  );
}
