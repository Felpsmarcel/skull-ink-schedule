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
import { useAppointmentDraft, totalFinalEur } from "@/stores/appointment-draft";
import { WizardStepMain, WizardSection } from "@/components/appointment-wizard/wizard-layout";
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
          (s) => s.name.toLowerCase().includes(needle) || s.category.toLowerCase().includes(needle),
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
      <WizardStepMain
        title="Defina os serviços"
        description="Escolha os serviços e confira o valor que será aplicado a cada sessão."
      >
        {draft.services.length > 0 ? (
          <WizardSection className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Selecionados ({draft.services.length})
            </h3>
            <div className="space-y-3">
              {draft.services.map((l) => {
                const catalogPrice = l.service.price_eur;
                const isEdited =
                  l.overridePriceEur != null &&
                  (l.service.price_on_request || l.overridePriceEur !== catalogPrice);
                return (
                  <div
                    key={l.service.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3"
                  >
                    <div className="min-w-0 flex-1 basis-40">
                      <div className="break-words text-sm">{l.service.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.service.duration_min} min · {modalityLabel(l.service.modality)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      {isEdited && !l.service.price_on_request ? (
                        <span className="text-xs text-muted-foreground line-through leading-none">
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
                            draft.setOverridePrice(l.service.id, v === "" ? null : Number(v));
                          }}
                          placeholder={l.service.price_on_request ? "0,00" : undefined}
                          aria-label={`Valor de ${l.service.name}`}
                          className={cn(
                            "h-11 w-24 rounded-lg text-right text-sm font-medium tabular-nums",
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
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Restaurar preço do catálogo de ${l.service.name}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => draft.removeService(l.service.id)}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`${t("appt.removeService")}: ${l.service.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </WizardSection>
        ) : null}

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("appt.searchService")}
              aria-label={t("appt.searchService")}
              className="h-12 rounded-xl pl-9"
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
            <WizardSection key={cat} className="overflow-hidden p-0 sm:p-0">
              <div className="border-b border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-foreground backdrop-blur">
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
                    aria-pressed={selected}
                    className={cn(
                      "flex min-h-18 w-full flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-4 text-left last:border-b-0 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      selected && "bg-primary/5",
                    )}
                  >
                    <div className="min-w-0 flex-1 basis-40">
                      <div className="flex items-center gap-2">
                        <span className="break-words text-sm font-medium">{s.name}</span>
                        {selected ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                      </div>
                      {s.description_short ? (
                        <div className="mt-0.5 text-xs text-muted-foreground/90">
                          {s.description_short}
                        </div>
                      ) : null}
                      <div className="text-xs text-muted-foreground">
                        {s.duration_min} min · {s.modality}
                      </div>
                    </div>
                    <span className="ml-auto whitespace-nowrap text-sm font-semibold tabular-nums">
                      {formatServicePrice(s)}
                    </span>
                  </button>
                );
              })}
            </WizardSection>
          ))
        )}
      </WizardStepMain>
      <WizardFooter
        showBack
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
