import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Loader2, Mail, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import "@/i18n";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useArtists } from "@/hooks/use-artists";
import { formatPrice, modalityLabel } from "@/lib/services";
import {
  useAppointmentDraft,
  totalFinalEur,
  totalOriginalEur,
} from "@/stores/appointment-draft";
import { useFinalizeAppointment } from "@/hooks/use-finalize-appointment";

export const Route = createFileRoute("/_authenticated/appointments/new/checkout")({
  head: () => ({ meta: [{ title: "Checkout — GF Tattoo Studio" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { t } = useTranslation();
  const draft = useAppointmentDraft();
  const { data: artists = [] } = useArtists();
  const staff = artists.find((s) => s.calendarId === draft.calendarId) ?? null;
  const { run, saving } = useFinalizeAppointment();
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
  const canFinalize = Boolean(
    draft.contact &&
      draft.calendarId &&
      staff &&
      draft.startISO &&
      draft.services.length > 0,
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-28">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
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
                const lineFinal = l.service.price_eur * (1 - l.discountPct / 100);
                const hasDisc = l.discountPct > 0;
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
                        {hasDisc ? (
                          <div className="text-[10px] text-muted-foreground line-through">
                            {formatPrice(l.service.price_eur)}
                          </div>
                        ) : null}
                        <div className="text-sm font-semibold">{formatPrice(lineFinal)}</div>
                      </div>
                    </div>
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
                        className="h-7 w-20 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => draft.removeService(l.service.id)}
                        className="ml-auto grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
        <section className="rounded-lg border border-border bg-card p-3 text-sm">
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
        </section>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center gap-2 border-t border-border bg-background/95 px-3 pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => toast(t("actions.comingSoon"))}
          disabled={saving}
        >
          {t("appt.payNow")}
        </Button>
        <Button className="flex-1" onClick={() => void run()} disabled={saving || !canFinalize}>
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