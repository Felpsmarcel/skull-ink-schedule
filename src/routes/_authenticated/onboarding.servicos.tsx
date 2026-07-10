import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Toaster } from "@/components/ui/sonner";
import {
  getMyArtistServices,
  listActiveServices,
  setArtistServices,
} from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/onboarding/servicos")({
  head: () => ({ meta: [{ title: "Serviços — GF Tattoo Studio" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ServicesStep,
});

function ServicesStep() {
  const navigate = useNavigate();
  const fetchAll = useServerFn(listActiveServices);
  const fetchMine = useServerFn(getMyArtistServices);
  const save = useServerFn(setArtistServices);

  const { data: services } = useQuery({ queryKey: ["active-services"], queryFn: () => fetchAll() });
  const { data: mine } = useQuery({ queryKey: ["my-artist-services"], queryFn: () => fetchMine() });

  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (mine) setPicked(new Set(mine));
  }, [mine]);

  const grouped = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string; duration_min: number }>>();
    (services ?? []).forEach((s) => {
      const arr = map.get(s.category) ?? [];
      arr.push({ id: s.id, name: s.name, duration_min: s.duration_min });
      map.set(s.category, arr);
    });
    return Array.from(map.entries());
  }, [services]);

  const mutation = useMutation({
    mutationFn: () => save({ data: { service_ids: Array.from(picked) } }),
    onSuccess: () => navigate({ to: "/onboarding/pronto" }),
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <Toaster position="top-center" />
      <div>
        <h1 className="text-xl font-bold">Serviços que você executa</h1>
        <p className="text-sm text-muted-foreground">
          Selecione os serviços do catálogo do estúdio que você atende.
        </p>
      </div>

      <div className="space-y-4">
        {grouped.map(([cat, items]) => (
          <div key={cat}>
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">{cat}</p>
            <ul className="space-y-1">
              {items.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                    <Checkbox checked={picked.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                    <span className="flex-1">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground">{s.duration_min} min</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {grouped.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum serviço no catálogo. Peça ao admin para cadastrar.</p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" asChild className="flex-1">
          <Link to="/onboarding/pronto">Pular por agora</Link>
        </Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="flex-1">
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Continuar
        </Button>
      </div>
    </div>
  );
}