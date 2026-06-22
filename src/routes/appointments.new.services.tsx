import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, Loader2, Check } from "lucide-react";
import "@/i18n";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchActiveServices, formatPrice, type Service } from "@/lib/services";
import { useAppointmentDraft } from "@/stores/appointment-draft";

export const Route = createFileRoute("/appointments/new/services")({
  head: () => ({ meta: [{ title: "Selecionar serviço — GF Tattoo Studio" }] }),
  component: ServicesPage,
});

function ServicesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const draft = useAppointmentDraft();
  const [q, setQ] = useState("");

  const query = useQuery({
    queryKey: ["services"],
    queryFn: fetchActiveServices,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const list = query.data ?? [];
    const needle = q.trim().toLowerCase();
    return needle
      ? list.filter(
          (s) =>
            s.name.toLowerCase().includes(needle) ||
            s.category.toLowerCase().includes(needle),
        )
      : list;
  }, [q, query.data]);

  const grouped = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const s of filtered) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const selectedIds = new Set(draft.services.map((l) => l.service.id));

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <Link
          to="/appointments/new"
          className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold">{t("appt.pickService")}</h1>
      </header>

      <div className="border-b border-border bg-background p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("appt.searchService")}
            className="pl-8"
          />
        </div>
      </div>

      <main className="flex-1 overflow-auto pb-6">
        {query.isLoading ? (
          <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> …
          </div>
        ) : query.error ? (
          <p className="p-4 text-xs text-destructive">{(query.error as Error).message}</p>
        ) : (query.data ?? []).length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            <p>{t("appt.noServicesCatalog")}</p>
            <p className="mt-1 text-xs">{t("appt.noServicesCatalogHint")}</p>
          </div>
        ) : grouped.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">{t("appt.noResults")}</p>
        ) : (
          grouped.map(([cat, items]) => (
            <section key={cat} className="border-b border-border">
              <div className="sticky top-0 bg-card/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                {cat} <span className="text-muted-foreground/60">({items.length})</span>
              </div>
              {items.map((s) => {
                const selected = selectedIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (selected) draft.removeService(s.id);
                      else draft.addService(s);
                      navigate({ to: "/appointments/new" });
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 border-b border-border/40 px-3 py-2.5 text-left hover:bg-muted",
                      selected && "bg-primary/5",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{s.name}</span>
                        {selected ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {s.duration_min} min · {s.modality}
                      </div>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatPrice(s.price_eur)}
                    </span>
                  </button>
                );
              })}
            </section>
          ))
        )}
      </main>
    </div>
  );
}