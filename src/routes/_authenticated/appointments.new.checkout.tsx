import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2, Mail, Phone, Trash2 } from "lucide-react";
import "@/i18n";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { useArtists } from "@/hooks/use-artists";
import { formatPrice, modalityLabel } from "@/lib/services";
import {
  useAppointmentDraft,
  balanceEur,
  draftValuesComplete,
  linePriceEur,
  totalFinalEur,
  totalOriginalEur,
} from "@/stores/appointment-draft";
import { useFinalizeAppointment } from "@/hooks/use-finalize-appointment";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listSellers } from "@/lib/sellers.functions";

export const Route = createFileRoute("/_authenticated/appointments/new/checkout")({
  head: () => ({
    meta: [
      { title: "Revisar agendamento — GF Tattoo Studio" },
      { name: "description", content: "Revise e confirme o agendamento." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { t } = useTranslation();
  const draft = useAppointmentDraft();
  const { data: artists = [] } = useArtists();
  const staff = artists.find((s) => s.calendarId === draft.calendarId) ?? null;
  const { run, saving } = useFinalizeAppointment();
  const fetchSellers = useServerFn(listSellers);
  const sellersQ = useQuery({
    queryKey: ["sellers", "active"],
    queryFn: () => fetchSellers({ data: {} }),
    staleTime: 5 * 60_000,
  });
  const sellers = sellersQ.data ?? [];
  const startLabel = useMemo(() => {
    if (!draft.startISO) return "—";
    return new Intl.DateTimeFormat("pt-PT", {
      timeZone: "Europe/Brussels",
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(draft.startISO));
  }, [draft.startISO]);

  const original = totalOriginalEur(draft);
  const final = totalFinalEur(draft);
  const hasDiscount = final < original;
  const deposit = Math.min(Math.max(0, draft.depositEur || 0), final);
  const balance = balanceEur(draft);
  const valuesComplete = draftValuesComplete(draft);
  const canFinalize = Boolean(
    draft.contact &&
      draft.calendarId &&
      staff &&
      draft.startISO &&
      draft.services.length > 0 &&
      valuesComplete &&
      (draft.depositEur || 0) <= final,
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-28">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <Link
          to="/appointments/new"
          className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-lg uppercase tracking-wide">{t("appt.checkoutTitle")}</h1>
      </header>

      <main className="flex-1 space-y-4 p-4">
        {/* Contact header */}
        <section className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-base font-semibold text-foreground">
            {(draft.contact?.contactName ?? draft.contact?.firstName ?? "?")
              .slice(0, 1)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {draft.contact?.contactName ??
                [draft.contact?.firstName, draft.contact?.lastName].filter(Boolean).join(" ") ??
                t("appt.noClient")}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {draft.contact?.phone ?? draft.contact?.email ?? ""}
            </div>
          </div>
          <div className="flex gap-1">
            <a
              href={draft.contact?.phone ? `tel:${draft.contact.phone}` : undefined}
              aria-disabled={!draft.contact?.phone}
              className={cn(
                "grid h-9 w-9 place-items-center rounded-md border border-border",
                draft.contact?.phone
                  ? "text-foreground hover:bg-muted"
                  : "pointer-events-none text-muted-foreground/40",
              )}
              aria-label="Ligar"
            >
              <Phone className="h-4 w-4" />
            </a>
            <a
              href={draft.contact?.email ? `mailto:${draft.contact.email}` : undefined}
              aria-disabled={!draft.contact?.email}
              className={cn(
                "grid h-9 w-9 place-items-center rounded-md border border-border",
                draft.contact?.email
                  ? "text-foreground hover:bg-muted"
                  : "pointer-events-none text-muted-foreground/40",
              )}
              aria-label="E-mail"
            >
              <Mail className="h-4 w-4" />
            </a>
          </div>
        </section>

        {/* Date + staff */}
        <section className="rounded-lg border border-border bg-card p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("appt.dateTime")}</span>
            <span className="font-medium">{startLabel}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted-foreground">{t("appt.staff")}</span>
            <span className="font-medium">{staff?.name ?? "—"}</span>
          </div>
          <div className="mt-2">
            <Label className="text-[11px] text-muted-foreground">Vendedor</Label>
            <Select
              value={draft.sellerId ?? "none"}
              onValueChange={(v) => draft.setSeller(v === "none" ? null : v)}
            >
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {sellers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.commissionPct > 0 ? ` (${s.commissionPct}%)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Services */}
        <section className="rounded-lg border border-border bg-card p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("appt.services")}
          </h2>
          {draft.services.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("appt.noServices")}</p>
          ) : (
            <ul className="space-y-2">
              {draft.services.map((l) => {
                const base = linePriceEur(l);
                const lineFinal = base * (1 - l.discountPct / 100);
                const hasDisc = l.discountPct > 0;
                const onRequest = l.service.price_on_request;
                return (
                  <li
                    key={l.service.id}
                    className="rounded border border-border/70 bg-background p-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{l.service.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {l.service.duration_min} min · {modalityLabel(l.service.modality)}
                        </div>
                      </div>
                      <div className="text-right">
                        {hasDisc && base > 0 ? (
                          <div className="text-[10px] text-muted-foreground line-through">
                            {formatPrice(base)}
                          </div>
                        ) : null}
                        <div className="text-sm font-semibold">
                          {onRequest && base === 0 ? "—" : formatPrice(lineFinal)}
                        </div>
                      </div>
                    </div>
                    {onRequest ? (
                      <div className="mt-2 flex items-center gap-2">
                        <Label className="text-[11px] text-muted-foreground">
                          Valor (€)
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.overridePriceEur ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            draft.setOverridePrice(
                              l.service.id,
                              v === "" ? null : Number(v),
                            );
                          }}
                          placeholder="0,00"
                          className="h-9 w-28 text-sm"
                        />
                      </div>
                    ) : null}
                    <div className="mt-2 flex items-center gap-2">
                      <Label className="text-[11px] text-muted-foreground">
                        {t("appt.discount")} %
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={l.discountPct}
                        onChange={(e) =>
                          draft.setDiscount(l.service.id, Number(e.target.value) || 0)
                        }
                        className="h-9 w-20 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => draft.removeService(l.service.id)}
                        className="ml-auto grid h-9 w-9 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={t("appt.removeService")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Notes */}
        <section className="rounded-lg border border-border bg-card p-3">
          <Label htmlFor="notes" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("appt.notes")}
          </Label>
          <Textarea
            id="notes"
            rows={4}
            value={draft.notes}
            onChange={(e) => draft.setNotes(e.target.value)}
            placeholder={t("appt.notesPlaceholder")}
          />
        </section>

        {/* Totals */}
        <section className="space-y-2 rounded-lg border border-border bg-card p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("appt.total")}</span>
            <div className="text-right">
              {hasDiscount ? (
                <div className="text-xs text-muted-foreground line-through">
                  {formatPrice(original)}
                </div>
              ) : null}
              <div className="text-lg font-bold">{formatPrice(final)}</div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="deposit" className="text-muted-foreground">
              Sinal pago (€)
            </Label>
            <Input
              id="deposit"
              type="number"
              min={0}
              step="0.01"
              value={draft.depositEur || ""}
              onChange={(e) => {
                const v = e.target.value;
                draft.setDeposit(v === "" ? 0 : Number(v));
              }}
              placeholder="0,00"
              className="h-9 w-32 text-right text-sm"
            />
          </div>

          {deposit > 0 ? (
            <div className="flex items-center justify-between border-t border-border pt-2">
              <span className="font-semibold">Saldo restante</span>
              <span className="text-lg font-bold">{formatPrice(balance)}</span>
            </div>
          ) : null}

          {draft.depositEur > final && final > 0 ? (
            <p className="text-[11px] text-destructive">
              O sinal não pode ser maior que o total.
            </p>
          ) : null}
          {!valuesComplete ? (
            <p className="text-[11px] text-destructive">
              Informe o valor dos serviços marcados como “sob consulta”.
            </p>
          ) : null}
        </section>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center gap-2 border-t border-border bg-background/95 px-3 pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button className="w-full" onClick={() => void run()} disabled={saving || !canFinalize}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("appt.finalize")}
          {final > 0 ? (
            <span className="ml-2 text-xs opacity-80">{formatPrice(final)}</span>
          ) : null}
        </Button>
      </footer>
    </div>
  );
}