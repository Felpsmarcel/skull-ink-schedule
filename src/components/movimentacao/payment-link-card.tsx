import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Banknote, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getMySlug } from "@/lib/movimentacao.functions";

const PROD_ORIGIN = "https://gftattoocalendar.com";

export function PaymentLinkCard() {
  const fetchSlug = useServerFn(getMySlug);
  const { data } = useQuery({
    queryKey: ["my-movimentacao-slug"],
    queryFn: () => fetchSlug(),
    staleTime: 60_000,
  });

  const slug = data?.slug;
  const [origin, setOrigin] = useState<string>(PROD_ORIGIN);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    if (host === "localhost" || host.endsWith(".lovable.app")) {
      setOrigin(window.location.origin);
    }
  }, []);

  if (!slug) return null;

  const url = `${origin}/movimentacao/${slug}`;
  const displayUrl = url.replace(/^https?:\/\//, "");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Banknote className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold uppercase tracking-wider">Seu link de pagamento</h2>
      </div>
      <p className="mb-3 break-all font-mono text-xs text-muted-foreground">{displayUrl}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copiar link de pagamento"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"
        >
          <Copy className="h-3.5 w-3.5" /> Copiar
        </button>
        <Link
          to="/movimentacao/$slug"
          params={{ slug }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Abrir
        </Link>
      </div>
    </div>
  );
}