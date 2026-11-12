import { useTranslation } from "react-i18next";
import { AlertTriangle as AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StatusBadge,
  bucketToVariant,
  bucketLabel,
  type PaymentBucketLike,
} from "@/components/ui/status-badge";
import { formatHHmm, type GridSlot } from "@/lib/agenda-grid";
import { cn } from "@/lib/utils";
export function AgendaBookingCard({
  slot,
  bucket,
  isNext,
  isHighlighted,
  onOpen,
}: {
  slot: GridSlot;
  bucket?: PaymentBucketLike;
  isNext?: boolean;
  isHighlighted?: boolean;
  onOpen: (slot: GridSlot) => void;
}) {
  const { t } = useTranslation();
  const span = Math.max(1, slot.spanSlots ?? 1);
  const cardHeight = span * 56 - 4; // 2px inset top/bottom
  const startLabel = formatHHmm(slot.eventStartMs ?? slot.startMs);
  const endLabel = slot.eventEndMs ? formatHHmm(slot.eventEndMs) : null;
  const stateLabels = [
    isNext ? t("agenda.next", { defaultValue: "Próximo" }) : null,
    slot.hasOverlap ? t("agenda.details.overlap") : null,
    bucket && cardHeight >= 100 ? bucketLabel(bucket) : null,
  ].filter(Boolean);

  return (
    <div className="relative h-14" style={{ overflow: "visible" }}>
      <Button
        variant="ghost"
        data-appointment-status={slot.appointmentStatus?.toLowerCase()}
        onClick={() => onOpen(slot)}
        aria-label={`${slot.contactName ?? t("agenda.client")} · ${startLabel}${endLabel ? ` – ${endLabel}` : ""} · ${slot.serviceName ?? t("agenda.booked")}${stateLabels.length ? ` · ${stateLabels.join(" · ")}` : ""}`}
        title={`${slot.contactName ?? t("agenda.client")} — ${slot.serviceName ?? t("agenda.booked")}`}
        className={cn(
          "agenda-session absolute left-[3px] right-[3px] top-[2px] z-[1] h-auto flex-col items-stretch justify-start gap-0.5 overflow-hidden whitespace-normal rounded-lg border border-border border-l-[3px] shadow-sm px-2 py-1 text-left text-foreground hover:bg-accent/40 hover:border-primary/40 focus-visible:ring-ring sm:py-1.5",
          isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
        style={{ height: cardHeight }}
      >
        {isNext ? (
          <span className="pointer-events-none absolute right-1 top-1 rounded-sm bg-primary/15 px-1 py-[1px] text-xs font-medium text-primary">
            {t("agenda.next", { defaultValue: "Próximo" })}
          </span>
        ) : null}
        <div
          className={cn("text-xs font-semibold tabular-nums text-foreground/80", isNext && "pr-16")}
        >
          {startLabel}
          {endLabel ? ` – ${endLabel}` : ""}
        </div>
        <div className="flex items-center gap-1">
          <span className="truncate text-sm font-semibold leading-tight">
            {slot.contactName ?? t("agenda.booked")}
          </span>
          {slot.hasOverlap ? (
            <AlertTriangleIcon
              className="h-3 w-3 shrink-0 text-agenda-warning"
              aria-label={t("agenda.details.overlap")}
            />
          ) : null}
        </div>
        {slot.serviceName && cardHeight >= 100 ? (
          <div className="line-clamp-2 text-xs font-normal leading-tight text-muted-foreground">
            {slot.serviceName}
          </div>
        ) : null}
        {bucket && cardHeight >= 100 ? (
          <StatusBadge
            variant={bucketToVariant(bucket)}
            className="mt-auto self-start px-1 py-0 text-xs normal-case"
          >
            {bucketLabel(bucket)}
          </StatusBadge>
        ) : null}
      </Button>
    </div>
  );
}
