import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Copy, Phone, Mail, AlertTriangle, ExternalLink } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { StatusBadge, bucketToVariant, bucketLabel } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { getContact } from "@/lib/ghl";
import type { PaymentBucket } from "@/lib/finance.functions";
import type { GridSlot } from "@/lib/agenda-grid";
import { resolveIntlLocale } from "@/lib/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: GridSlot | null;
  staffName: string;
  calendarId: string;
  bucket?: PaymentBucket;
  debug?: boolean;
}

export function AgendaAppointmentSheet({
  open,
  onOpenChange,
  slot,
  staffName,
  calendarId,
  bucket,
  debug,
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = resolveIntlLocale(i18n.language);

  const contactId = slot?.contactId ?? null;

  const contactQ = useQuery({
    queryKey: ["ghl-contact", contactId],
    enabled: Boolean(open && contactId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await getContact(contactId!);
      if (!r.ok) throw new Error(`GHL ${r.status}`);
      return r.data.contact ?? null;
    },
  });

  const startMs = slot?.eventStartMs ?? slot?.startMs;
  const endMs = slot?.eventEndMs;
  const durationMin =
    startMs != null && endMs != null ? Math.max(0, Math.round((endMs - startMs) / 60000)) : 0;

  const whenLine = startMs
    ? formatWhen(locale, startMs, endMs ?? startMs)
    : "";
  const durationLine = durationMin > 0 ? formatDuration(durationMin) : "";

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("agenda.details.copied"));
    } catch {
      toast.error(t("common.error.title"));
    }
  };

  const contact = contactQ.data ?? null;
  const fallbackName = slot?.contactName ?? t("agenda.booked");
  const displayName =
    contact?.contactName ||
    [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") ||
    fallbackName;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="text-left">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="truncate font-display text-lg uppercase tracking-wide">
              {displayName}
            </SheetTitle>
            {bucket ? (
              <StatusBadge variant={bucketToVariant(bucket)} className="shrink-0">
                {bucketLabel(bucket)}
              </StatusBadge>
            ) : null}
          </div>
          <SheetDescription className="text-xs">
            {whenLine}
            {durationLine ? ` · ${durationLine}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5 text-sm">
          {slot?.hasOverlap ? (
            <div className="flex items-start gap-2 rounded border border-warning-foreground/20 bg-warning/10 p-2 text-[12px] text-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{t("agenda.details.overlap")}</span>
            </div>
          ) : null}

          <Row label={t("agenda.details.artist")} value={staffName} />
          <Row
            label={t("agenda.details.service")}
            value={slot?.serviceName || t("agenda.booked")}
          />
          {slot?.appointmentStatus ? (
            <Row label={t("agenda.details.status")} value={slot.appointmentStatus} />
          ) : null}

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("agenda.details.contact")}
            </div>
            {!contactId ? (
              <p className="text-xs text-muted-foreground">{t("agenda.details.noContact")}</p>
            ) : contactQ.isLoading ? (
              <LoadingState inline size="sm" />
            ) : contactQ.error ? (
              <ErrorState
                description={t("agenda.details.contactError")}
                details={(contactQ.error as Error).message}
                onRetry={() => contactQ.refetch()}
              />
            ) : (
              <div className="space-y-2">
                <ContactLine
                  icon={<Phone className="h-3.5 w-3.5" />}
                  value={contact?.phone ?? null}
                  href={contact?.phone ? `tel:${contact.phone}` : undefined}
                  actionLabel={t("agenda.details.call")}
                  emptyLabel="—"
                  onCopy={copy}
                />
                <ContactLine
                  icon={<Mail className="h-3.5 w-3.5" />}
                  value={contact?.email ?? null}
                  href={contact?.email ? `mailto:${contact.email}` : undefined}
                  actionLabel={t("agenda.details.sendEmail")}
                  emptyLabel="—"
                  onCopy={copy}
                />
              </div>
            )}
          </div>

          {debug ? (
            <details className="rounded border border-border/60 bg-muted/40 p-2 text-[10px]">
              <summary className="cursor-pointer font-semibold">debug</summary>
              <div className="mt-1 space-y-0.5 font-mono">
                <div>event: {slot?.ghlEventId ?? "—"}</div>
                <div>calendar: {calendarId}</div>
                <div>contact: {contactId ?? "—"}</div>
                <div>span: {slot?.spanSlots ?? "?"} slots</div>
              </div>
            </details>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function ContactLine({
  icon,
  value,
  href,
  actionLabel,
  emptyLabel,
  onCopy,
}: {
  icon: React.ReactNode;
  value: string | null;
  href?: string;
  actionLabel: string;
  emptyLabel: string;
  onCopy: (v: string) => void;
}) {
  const { t } = useTranslation();
  if (!value) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{emptyLabel}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="min-w-0 flex-1 truncate text-sm">{value}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[11px]"
        onClick={() => onCopy(value)}
      >
        <Copy className="mr-1 h-3 w-3" />
        {t("agenda.details.copy")}
      </Button>
      {href ? (
        <a
          href={href}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] hover:bg-muted"
        >
          <ExternalLink className="h-3 w-3" />
          {actionLabel}
        </a>
      ) : null}
    </div>
  );
}

function formatWhen(locale: string, startMs: number, endMs: number): string {
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(startMs));
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${day} · ${time.format(new Date(startMs))} – ${time.format(new Date(endMs))}`;
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${m}min`;
}