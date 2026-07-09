import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Check, RotateCcw, Search, Trash2 } from "lucide-react";
import "@/i18n";

import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import {
  fetchActiveServices,
  formatPrice,
  formatServicePrice,
  modalityLabel,
  type Service,
} from "@/lib/services";
import { useAppointmentDraft, linePriceEur, totalFinalEur } from "@/stores/appointment-draft";
import { WizardFooter } from "@/components/appointment-wizard/wizard-footer";

export const Route = createFileRoute("/_authenticated/appointments/new/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — Novo agendamento" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ServicosStep,
});

function ServicosStep() {
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
  const canContinue = draft.services.length > 0;
  const finalTotal = totalFinalEur(draft);

  return (
    <>
      <main className="flex-1 pb-6">
        {draft.services.length > 0 ? (
          <section className="space-y-2 border-b border-border bg-card/40 p-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Selecionados ({draft.services.length})
            </h2>
            <div className="space-y-1.5">
              {draft.services.map((l) => {
                const catalogPrice = l.service.price_eur;
                const isEdited =
                  l.overridePriceEur != null &&
                  (l.service.price_on_request || l.overridePriceEur !== catalogPrice);
                return (
                  <div
                    key={l.service.id}
                    className="flex items-center gap-2 rounded border border-border/70 bg-background px-2 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{l.service.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {l.service.duration_min} min · {modalityLabel(l.service.modality)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      {isEdited && !l.service.price_on_request ? (
                        <span className="text-[10px] text-muted-foreground line-through leading-none">
                          {formatPrice(catalogPrice)}
                        </span>
                      ) : null}
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={
                            l.overridePriceEur != null
                              ? l.overridePriceEur
                              : l.service.price_on_request
                                ? ""
                                : catalogPrice
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            draft.setOverridePrice(
                              l.service.id,
                              v === "" ? null : Number(v),
                            );
                          }}
                          placeholder={l.service.price_on_request ? "0,00" : undefined}
                          aria-label={`Valor de ${l.service.name}`}
                          className={cn(
                            "h-9 w-20 text-right text-sm font-medium tabular-nums",
                            isEdited && "border-primary/60 text-primary",
                          )}
                        />
                        <span className="text-xs text-muted-foreground">€</span>
                      </div>
                    </div>
                    {isEdited ? (
                      <button
                        type="button"
                        onClick={() => draft.setOverridePrice(l.service.id, null)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Restaurar preço do catálogo"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => draft.removeService(l.service.id)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t("appt.removeService")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

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

        {query.isLoading ? (
          <div className="p-4">
            <LoadingState inline size="sm" />
          </div>
        ) : query.error ? (
          <div className="p-4">
            <ErrorState
              description="Não foi possível carregar os serviços."
              details={(query.error as Error).message}
              onRetry={() => query.refetch()}
            />
          </div>
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
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 border-b border-border/40 px-3 py-3 text-left hover:bg-muted",
                      selected && "bg-primary/5",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{s.name}</span>
                        {selected ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                      </div>
                      {s.description_short ? (
                        <div className="mt-0.5 text-[11px] text-muted-foreground/90">
                          {s.description_short}
                        </div>
                      ) : null}
                      <div className="text-[11px] text-muted-foreground">
                        {s.duration_min} min · {s.modality}
                      </div>
                    </div>
                    <span className="whitespace-nowrap text-sm font-semibold">
                      {formatServicePrice(s)}
                    </span>
                  </button>
                );
              })}
            </section>
          ))
        )}
      </main>
      <WizardFooter
        backTo="/appointments/new/agenda"
        primary={
          canContinue ? (
            <span className="flex items-center gap-2">
              {t("appt.wizard.next")}
              {finalTotal > 0 ? (
                <span className="text-xs opacity-80">· {formatPrice(finalTotal)}</span>
              ) : null}
            </span>
          ) : (
            t("appt.cta.addService")
          )
        }
        primaryDisabled={!canContinue}
        onPrimary={() => navigate({ to: "/appointments/new/revisao" })}
      />
    </>
  );
}
// linePriceEur retained for potential future per-line display
void linePriceEur;