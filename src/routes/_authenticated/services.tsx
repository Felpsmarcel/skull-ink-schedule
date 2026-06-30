import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Power, Loader2 } from "lucide-react";
import { toast } from "sonner";
import "@/i18n";

import { BottomNav } from "@/components/layout/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatPriceRange, type ServiceModality } from "@/lib/services";
import { listAllServices, createService, updateService, toggleServiceActive } from "@/lib/services.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/services")({
  head: () => ({ meta: [{ title: "Serviços — GF Tattoo Studio" }] }),
  component: ServicesPage,
});

type Row = Awaited<ReturnType<typeof listAllServices>>[number];

const MODALITIES: ServiceModality[] = ["presencial", "consulta_online", "hibrido"];

function toNum(v: number | string | null): number {
  if (v == null) return 0;
  return typeof v === "string" ? Number(v) : v;
}

function ServicesPage() {
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === "admin";
  const qc = useQueryClient();
  const list = useServerFn(listAllServices);
  const q = useQuery({ queryKey: ["services", "all"], queryFn: () => list(), staleTime: 60_000 });
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const byCat = new Map<string, Row[]>();
    for (const s of q.data ?? []) {
      const k = s.category || "Outros";
      if (!byCat.has(k)) byCat.set(k, []);
      byCat.get(k)!.push(s);
    }
    return [...byCat.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [q.data]);

  const toggleFn = useServerFn(toggleServiceActive);
  const toggleMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggleFn({ data: v }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["services"] });
      toast.success("Atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const togglingId =
    toggleMut.isPending ? (toggleMut.variables as { id: string } | undefined)?.id : undefined;

  return (
    <div className="min-h-svh bg-background pb-24 text-foreground">
      <Toaster position="top-center" />
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <h1 className="text-base font-bold uppercase tracking-wider">Serviços</h1>
        {isAdmin && (
          <Sheet
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setEditing(null);
            }}
          >
            <SheetTrigger asChild>
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Novo
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[92svh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{editing ? "Editar serviço" : "Novo serviço"}</SheetTitle>
              </SheetHeader>
              <ServiceForm
                initial={editing}
                onDone={async () => {
                  await qc.invalidateQueries({ queryKey: ["services"] });
                  setOpen(false);
                  setEditing(null);
                }}
              />
            </SheetContent>
          </Sheet>
        )}
      </header>

      <div className="mx-auto max-w-md px-4 py-4">
        {q.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : grouped.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Catálogo vazio.</p>
        ) : (
          <div className="space-y-6">
            {grouped.map(([cat, items]) => (
              <section key={cat}>
                <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {cat}
                </h2>
                <ul className="space-y-2">
                  {items.map((s) => (
                    <li
                      key={s.id}
                      className={cn(
                        "rounded-lg border border-border bg-card p-3",
                        !s.active && "opacity-60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold">{s.name}</p>
                            {!s.active && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                                Inativo
                              </span>
                            )}
                          </div>
                          {s.description_short && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {s.description_short}
                            </p>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {formatPriceRange(toNum(s.price_eur), toNum(s.price_max_eur))}
                            </span>
                            <span>{s.duration_min} min</span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex shrink-0 flex-col gap-1">
                            <button
                              type="button"
                              aria-label="Editar"
                              onClick={() => {
                                setEditing(s);
                                setOpen(true);
                              }}
                              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={s.active ? "Desativar" : "Ativar"}
                              disabled={togglingId === s.id}
                              onClick={() => toggleMut.mutate({ id: s.id, active: !s.active })}
                              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                            >
                              {togglingId === s.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <BottomNav active="services" />
    </div>
  );
}

function ServiceForm({ initial, onDone }: { initial: Row | null; onDone: () => void | Promise<void> }) {
  const create = useServerFn(createService);
  const update = useServerFn(updateService);
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [duration, setDuration] = useState(String(initial?.duration_min ?? 60));
  const [modality, setModality] = useState<ServiceModality>(initial?.modality ?? "presencial");
  const [priceMin, setPriceMin] = useState(String(initial ? toNum(initial.price_eur) : 0));
  const [priceMax, setPriceMax] = useState(
    initial?.price_max_eur != null ? String(toNum(initial.price_max_eur)) : "",
  );
  const [descShort, setDescShort] = useState(initial?.description_short ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        category: category.trim(),
        duration_min: Number(duration) || 0,
        modality,
        price_eur: Number(priceMin) || 0,
        price_max_eur: priceMax.trim() === "" ? null : Number(priceMax),
        description: desc.trim() || null,
        description_short: descShort.trim() || null,
        active,
      };
      if (initial) {
        await update({ data: { id: initial.id, patch: payload } });
      } else {
        await create({ data: payload });
      }
    },
    onSuccess: async () => {
      toast.success(initial ? "Serviço atualizado" : "Serviço criado");
      await onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    saveMut.mutate();
  }
  const busy = saveMut.isPending;

  return (
    <form onSubmit={submit} className="space-y-3 pt-4">
      <div>
        <Label htmlFor="sf-name">Nome</Label>
        <Input id="sf-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="sf-cat">Categoria</Label>
          <Input id="sf-cat" value={category} onChange={(e) => setCategory(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="sf-dur">Duração (min)</Label>
          <Input id="sf-dur" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} required />
        </div>
      </div>
      <div>
        <Label htmlFor="sf-mod">Modalidade</Label>
        <select
          id="sf-mod"
          value={modality}
          onChange={(e) => setModality(e.target.value as ServiceModality)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {MODALITIES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="sf-pmin">Preço (€)</Label>
          <Input id="sf-pmin" type="number" step="0.01" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="sf-pmax">Preço máx (€)</Label>
          <Input id="sf-pmax" type="number" step="0.01" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="—" />
        </div>
      </div>
      <div>
        <Label htmlFor="sf-ds">Descrição curta</Label>
        <Input id="sf-ds" value={descShort ?? ""} onChange={(e) => setDescShort(e.target.value)} maxLength={200} />
      </div>
      <div>
        <Label htmlFor="sf-d">Descrição</Label>
        <Textarea id="sf-d" value={desc ?? ""} onChange={(e) => setDesc(e.target.value)} rows={3} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Ativo
      </label>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : initial ? "Salvar" : "Criar"}
      </Button>
    </form>
  );
}