import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  AlertTriangle,
  Bug,
} from "lucide-react";
import "@/i18n";

import { useStaffDayAgenda } from "@/hooks/use-agenda";
import { useStaffRangeAgenda } from "@/hooks/use-agenda-range";
import {
  useDayAppointmentStatuses,
  useRangeAppointmentStatuses,
} from "@/hooks/use-agenda-status";
import type { PaymentBucket } from "@/lib/finance.functions";
import {
  StatusBadge,
  bucketToVariant,
  bucketLabel,
} from "@/components/ui/status-badge";
import {
  DEFAULT_START_HOUR,
  DEFAULT_END_HOUR,
  SLOT_MINUTES,
  brusselsAddDays,
  brusselsDayKey,
  brusselsDayStartMs,
  brusselsMonthEndMs,
  brusselsMonthStartMs,
  brusselsWeekEndMs,
  brusselsWeekStartMs,
  enumerateBrusselsDays,
} from "@/lib/agenda-grid";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { resolveIntlLocale } from "@/lib/locale";
import { useAppointmentDraft } from "@/stores/appointment-draft";
import type { GhlEvent } from "@/lib/ghl";
import { AgendaAppointmentSheet } from "@/components/agenda-appointment-sheet";
import type { GridSlot } from "@/lib/agenda-grid";
import { AlertTriangle as AlertTriangleIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type View = "day" | "week" | "month";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — GF Tattoo Studio" },
      { name: "description", content: "Sua agenda de atendimentos no GF Tattoo Studio." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => {
    const on = s.debug === "1" || s.debug === 1 || s.debug === true || s.debug === "true";
    const rawView = typeof s.view === "string" ? s.view.toLowerCase() : undefined;
    const view: View | undefined =
      rawView === "week" || rawView === "month" || rawView === "day"
        ? (rawView as View)
        : undefined;
    const out: { debug?: true; view?: View } = {};
    if (on) out.debug = true;
    if (view && view !== "day") out.view = view;
    return out;
  },
  component: AgendaPage,
});

const COL_WIDTH = "w-full sm:w-auto sm:min-w-[140px] sm:basis-0 sm:grow";
const ROW_HEIGHT = "h-14";
const ROW_HEIGHT_PX = 56; // must match ROW_HEIGHT (h-14 = 56px)

function defaultTimeLabels(): string[] {
  const out: string[] = [];
  for (let min = DEFAULT_START_HOUR * 60; min < DEFAULT_END_HOUR * 60; min += SLOT_MINUTES) {
    out.push(
      `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`,
    );
  }
  return out;
}

function AgendaPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate({ from: "/agenda" });
  const search = Route.useSearch() as { debug?: boolean; view?: View };
  const debug = search.debug === true;
  const view: View = search.view ?? "day";
  const setView = (v: View) =>
    navigate({
      search: (prev: { debug?: boolean; view?: View }) => ({
        ...prev,
        view: v === "day" ? undefined : v,
      }),
      replace: true,
    });
  const [date, setDate] = useState<Date>(() => new Date());
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: me } = useCurrentUser();
  const restrictArtistId = me?.role === "artist" ? me.artistId : null;

  const dateLabel = useMemo(() => {
    const locale = resolveIntlLocale(i18n.language);
    if (view === "day") {
      return new Intl.DateTimeFormat(locale, {
        timeZone: "Europe/Brussels",
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
    }
    if (view === "week") {
      const start = new Date(brusselsWeekStartMs(date));
      const end = new Date(brusselsWeekStartMs(date) + 6 * 24 * 3600 * 1000);
      const f = new Intl.DateTimeFormat(locale, {
        timeZone: "Europe/Brussels",
        day: "2-digit",
        month: "short",
      });
      return `${f.format(start)} – ${f.format(end)}`;
    }
    return new Intl.DateTimeFormat(locale, {
      timeZone: "Europe/Brussels",
      month: "long",
      year: "numeric",
    }).format(date);
  }, [date, view, i18n.language]);

  function shift(delta: number) {
    const d = new Date(date);
    if (view === "day") d.setDate(d.getDate() + delta);
    else if (view === "week") d.setDate(d.getDate() + delta * 7);
    else d.setMonth(d.getMonth() + delta);
    setDate(d);
  }

  const goToDay = (d: Date) => {
    setDate(d);
    setView("day");
  };

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40 pb-20">
      <Toaster theme="light" position="top-center" />

      {/* Header — editorial monochrome */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-1 items-center gap-1 sm:flex-none sm:gap-2">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t("agenda.prev")}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                >
                  <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span
                    className="truncate text-base uppercase tracking-tight text-foreground sm:text-lg"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {dateLabel}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) {
                      setDate(d);
                      setPickerOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>

            <button
              type="button"
              onClick={() => shift(1)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t("agenda.next")}
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setDate(new Date())}
              className="ml-1 hidden rounded-full border border-border bg-card px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:border-foreground hover:text-foreground sm:inline-flex"
            >
              {t("agenda.today")}
            </button>
          </div>

          <Tabs
            value={view}
            onValueChange={(v) => setView(v as View)}
            className="w-full sm:w-auto"
          >
            <TabsList className="h-9 rounded-lg bg-muted p-1">
              <TabsTrigger
                value="day"
                className="rounded-md px-3 text-[11px] font-bold uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                {t("agenda.view.day")}
              </TabsTrigger>
              <TabsTrigger
                value="week"
                className="rounded-md px-3 text-[11px] font-bold uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                {t("agenda.view.week")}
              </TabsTrigger>
              <TabsTrigger
                value="month"
                className="rounded-md px-3 text-[11px] font-bold uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                {t("agenda.view.month")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {view === "day" ? (
        <DayView
          date={date}
          restrictArtistId={restrictArtistId}
          meReady={Boolean(me)}
          debug={debug}
        />
      ) : view === "week" ? (
        <WeekView
          date={date}
          restrictArtistId={restrictArtistId}
          meReady={Boolean(me)}
          onPickDay={goToDay}
        />
      ) : (
        <MonthView
          date={date}
          restrictArtistId={restrictArtistId}
          meReady={Boolean(me)}
          onPickDay={goToDay}
        />
      )}
    </div>
  );
}

/* ============================= DAY VIEW ============================= */

function DayView({
  date,
  restrictArtistId,
  meReady,
  debug,
}: {
  date: Date;
  restrictArtistId: string | null | undefined;
  meReady: boolean;
  debug: boolean;
}) {
  const { t } = useTranslation();
  const { agendas } = useStaffDayAgenda(date, {
    artistId: restrictArtistId,
    enabled: meReady,
  });
  const { map: statusMap } = useDayAppointmentStatuses(date, meReady);

  // Mobile: show one artist column at a time (chips selector).
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const effectiveActiveId =
    activeStaffId && agendas.some((a) => a.staff.id === activeStaffId)
      ? activeStaffId
      : agendas[0]?.staff.id ?? null;

  const rowCount = agendas.reduce((m, a) => Math.max(m, a.slots.length), 0);
  const timeColumn =
    rowCount > 0
      ? (agendas.find((a) => a.slots.length === rowCount)?.slots ?? []).map((s) => s.label)
      : defaultTimeLabels();

  const totals = useMemo(() => {
    let booked = 0;
    let free = 0;
    for (const a of agendas) {
      booked += a.bookedCount;
      free += a.freeCount;
    }
    return { booked, free };
  }, [agendas]);

  // "Now" indicator position (px from top of grid body) — visible only when today
  const nowTopPx = useMemo(() => {
    const now = new Date();
    const isToday = brusselsDayKey(now) === brusselsDayKey(date);
    if (!isToday) return null;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Brussels",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(now)
      .split(":")
      .map(Number);
    const [h, m] = parts;
    const startMin = DEFAULT_START_HOUR * 60;
    const endMin = DEFAULT_END_HOUR * 60;
    const nowMin = h * 60 + m;
    if (nowMin < startMin || nowMin > endMin) return null;
    const offsetSlots = (nowMin - startMin) / SLOT_MINUTES;
    return offsetSlots * ROW_HEIGHT_PX;
  }, [date]);

  const nowLabel = useMemo(() => {
    if (nowTopPx == null) return null;
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Brussels",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  }, [nowTopPx]);

  const [openSlot, setOpenSlot] = useState<{
    slot: GridSlot;
    staffName: string;
    calendarId: string;
  } | null>(null);

  return (
    <>
      {debug ? (
        <div className="border-b border-border bg-card/50 p-2 text-[10px] text-muted-foreground">
          <div className="mb-1 flex items-center gap-1 font-bold text-foreground">
            <Bug className="h-3 w-3" /> DEBUG (?debug=1)
          </div>
          {agendas.map((a) => (
            <details key={a.staff.id} className="mb-1 rounded border border-border/50 p-1">
              <summary className="cursor-pointer">
                {a.staff.shortName} — free:{a.debug?.freeStartsCount ?? "?"} ev:
                {a.debug?.eventsCount ?? "?"} {a.error ? "· ERR" : ""}
              </summary>
              {a.error ? <div className="text-destructive">{a.error}</div> : null}
            </details>
          ))}
        </div>
      ) : null}

      {/* KPI ribbon */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest sm:gap-x-6 sm:px-6 sm:py-3 sm:text-[11px]">
          <div className="flex items-center gap-2 text-foreground">
            <span className="h-2 w-2 rounded-full bg-foreground" aria-hidden />
            <span>{t("agenda.kpi.sessions", { n: totals.booked })}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full border border-border" aria-hidden />
            <span>{t("agenda.kpi.free", { n: totals.free })}</span>
          </div>
          <div className="ml-auto hidden items-center gap-4 text-[10px] font-medium normal-case text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-border bg-muted" />
              {t("agenda.kpi.legendReceive")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-foreground" />
              {t("agenda.kpi.legendPaid")}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile-only artist chip selector */}
      {agendas.length > 1 ? (
        <div className="border-b border-border bg-background sm:hidden">
          <div className="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {agendas.map((a) => {
              const active = a.staff.id === effectiveActiveId;
              return (
                <button
                  key={a.staff.id}
                  type="button"
                  onClick={() => setActiveStaffId(a.staff.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  )}
                >
                  <span className="truncate max-w-[140px]">{a.staff.shortName}</span>
                  <span
                    className={cn(
                      "rounded-sm px-1 text-[9px] tabular-nums",
                      active ? "bg-background/20" : "bg-muted",
                    )}
                  >
                    {a.bookedCount}·{a.freeCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Grid card */}
      <div className="mx-auto w-full max-w-[1400px] flex-1 px-2 py-4 sm:px-6">
        <div className="h-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="h-full overflow-auto">
            <div className="relative flex w-full min-w-full">
              {/* Time column */}
              <div className="sticky left-0 z-10 shrink-0 border-r border-border bg-card">
                <div className="h-16 border-b border-border" />
                {timeColumn.map((label) => (
                  <div
                    key={label}
                    className={cn(
                      "flex w-10 items-start justify-center border-b border-border/40 pt-1 text-[9px] font-medium tabular-nums text-muted-foreground sm:w-14 sm:text-[10px]",
                      ROW_HEIGHT,
                    )}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="relative flex flex-1">
                {agendas.map((a) => {
                  const isActive = a.staff.id === effectiveActiveId;
                  return (
                    <div
                      key={a.staff.id}
                      className={cn(
                        "sm:contents",
                        isActive ? "flex w-full" : "hidden",
                      )}
                    >
                      <StaffColumn
                        agenda={a}
                        statusMap={statusMap}
                        onOpen={(slot) =>
                          setOpenSlot({
                            slot,
                            staffName: a.staff.shortName,
                            calendarId: a.staff.calendarId,
                          })
                        }
                      />
                    </div>
                  );
                })}
                {/* Now line */}
                {nowTopPx != null ? (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                    style={{ top: `calc(4rem + ${nowTopPx}px)` }}
                    aria-hidden
                  >
                    <span className="ml-1 rounded-sm bg-foreground px-1 py-[1px] text-[9px] font-black tracking-widest text-background">
                      {nowLabel}
                    </span>
                    <div className="h-px flex-1 bg-foreground" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
      <AgendaAppointmentSheet
        open={Boolean(openSlot)}
        onOpenChange={(o) => {
          if (!o) setOpenSlot(null);
        }}
        slot={openSlot?.slot ?? null}
        staffName={openSlot?.staffName ?? ""}
        calendarId={openSlot?.calendarId ?? ""}
        bucket={
          openSlot?.slot.ghlEventId
            ? statusMap.get(openSlot.slot.ghlEventId)
            : undefined
        }
        debug={debug}
      />
    </>
  );
}

function StaffColumn({
  agenda,
  statusMap,
  onOpen,
}: {
  agenda: ReturnType<typeof useStaffDayAgenda>["agendas"][number];
  statusMap: Map<string, PaymentBucket>;
  onOpen: (slot: GridSlot) => void;
}) {
  const { t } = useTranslation();
  const { staff, slots, isLoading, error } = agenda;

  return (
    <div className={cn("flex flex-col border-l border-border", COL_WIDTH)}>
      {/* Column header — editorial */}
      <div className="sticky top-0 z-10 flex h-16 flex-col items-center justify-center gap-0.5 border-b border-border bg-muted/40 px-2 py-2 text-center">
        <span
          className="truncate text-[13px] uppercase leading-none tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {staff.shortName}
        </span>
        {error && agenda.slots.length === 0 ? (
          <StatusBadge
            variant="danger"
            title={error}
            icon={<AlertTriangle className="h-3 w-3" />}
            className="mt-1"
          >
            {t("agenda.errorLoading")}
          </StatusBadge>
        ) : (
          <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("agenda.staff.summary", {
              booked: agenda.bookedCount,
              free: agenda.freeCount,
            })}
          </span>
        )}
      </div>

      {/* Slots */}
      <div className="flex-1">
        {isLoading ? (
          Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className={cn("border-b border-border/30 p-1", ROW_HEIGHT)}>
              <div className="h-full w-full animate-pulse rounded bg-muted/40" />
            </div>
          ))
        ) : error && slots.length === 0 ? (
          <div
            className="flex flex-col items-center gap-1 p-2 text-center"
            title={error}
          >
            <StatusBadge
              variant="danger"
              icon={<AlertTriangle className="h-3 w-3" />}
            >
              {t("agenda.errorLoading")}
            </StatusBadge>
          </div>
        ) : (
          slots.map((slot) => (
            <SlotCell
              key={slot.startMs}
              slot={slot}
              calendarId={staff.calendarId}
              statusMap={statusMap}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SlotCell({
  slot,
  calendarId,
  statusMap,
  onOpen,
}: {
  slot: import("@/lib/agenda-grid").GridSlot;
  calendarId: string;
  statusMap: Map<string, PaymentBucket>;
  onOpen: (slot: GridSlot) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const draft = useAppointmentDraft();

  if (slot.status === "outside") {
    return <div className={cn("border-b border-border/30 bg-background/40", ROW_HEIGHT)} />;
  }

  if (slot.status === "free") {
    return (
      <div className={cn("group border-b border-border/30 p-0.5", ROW_HEIGHT)}>
        <button
          type="button"
          onClick={() => {
            draft.reset();
            draft.setCalendar(calendarId);
            draft.setStart(new Date(slot.startMs).toISOString());
            void navigate({ to: "/appointments/new" });
          }}
          aria-label={t("agenda.addSlot")}
          title={t("agenda.addSlot")}
          className="flex h-full w-full items-center justify-center rounded-md bg-transparent text-[10px] font-bold uppercase tracking-widest text-transparent transition-all hover:border hover:border-dashed hover:border-foreground/40 hover:bg-muted/40 hover:text-muted-foreground"
        >
          + {t("agenda.addSlot")}
        </button>
      </div>
    );
  }

  // booked — continuation slots render an invisible spacer so the time
  // column on the left stays aligned; the first slot renders a single
  // absolutely-positioned card that spans all of its slots.
  if (!slot.isFirstSlot) {
    return <div className={cn(ROW_HEIGHT)} aria-hidden="true" />;
  }

  const bucket = slot.ghlEventId ? statusMap.get(slot.ghlEventId) : undefined;
  const span = Math.max(1, slot.spanSlots ?? 1);
  const cardHeight = span * ROW_HEIGHT_PX - 4; // 2px inset top/bottom
  const startLabel = fmtHHmm(slot.eventStartMs ?? slot.startMs);
  const endLabel = slot.eventEndMs ? fmtHHmm(slot.eventEndMs) : null;

  return (
    <div
      className={cn("relative", ROW_HEIGHT)}
      style={{ overflow: "visible" }}
    >
      <button
        type="button"
        onClick={() => onOpen(slot)}
        title={`${slot.contactName ?? t("agenda.client")} — ${slot.serviceName ?? t("agenda.booked")}`}
        className="absolute left-[3px] right-[3px] top-[2px] z-[1] flex flex-col justify-start gap-0.5 overflow-hidden rounded-md border border-border border-l-4 border-l-foreground bg-background px-1.5 py-1 text-left text-foreground shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-foreground/40 sm:px-2 sm:py-1.5"
        style={{ height: cardHeight }}
      >
        <div className="flex items-center gap-1">
          <span
            className="truncate text-[11px] uppercase leading-tight tracking-tight sm:text-[12px]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {slot.contactName ?? t("agenda.booked")}
          </span>
          {slot.hasOverlap ? (
            <AlertTriangleIcon
              className="h-3 w-3 shrink-0 text-foreground"
              aria-label={t("agenda.details.overlap")}
            />
          ) : null}
        </div>
        {slot.serviceName ? (
          <div className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">{slot.serviceName}</div>
        ) : null}
        <div className="text-[10px] font-medium tabular-nums text-muted-foreground">
          {startLabel}
          {endLabel ? ` – ${endLabel}` : ""}
        </div>
        {bucket && cardHeight >= 84 ? (
          <StatusBadge
            variant={bucketToVariant(bucket)}
            className="mt-auto self-start px-1 py-0 text-[9px]"
          >
            {bucketLabel(bucket)}
          </StatusBadge>
        ) : null}
      </button>
    </div>
  );
}

const _hhmmFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Brussels",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
function fmtHHmm(ms: number): string {
  return _hhmmFmt.format(new Date(ms));
}

/* ============================ WEEK VIEW ============================ */

function WeekView({
  date,
  restrictArtistId: _restrictArtistId,
  meReady,
  onPickDay,
}: {
  date: Date;
  restrictArtistId: string | null | undefined;
  meReady: boolean;
  onPickDay: (d: Date) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveIntlLocale(i18n.language);
  const startMs = brusselsWeekStartMs(date);
  const endMs = brusselsWeekEndMs(date);
  const days = enumerateBrusselsDays(startMs, endMs + 1);

  // Show ALL artists in week view — calendar visibility is not restricted.
  const { agendas, isFetching } = useStaffRangeAgenda(startMs, endMs, {
    artistId: null,
    enabled: meReady,
  });
  const { map: statusMap } = useRangeAppointmentStatuses(startMs, endMs, meReady);

  const totalEvents = useMemo(
    () => agendas.reduce((n, a) => n + a.events.length, 0),
    [agendas],
  );

  const dayFmt = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    weekday: "short",
  });
  const numFmt = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    day: "2-digit",
  });

  const todayKey = brusselsDayKey(new Date());

  // Mobile: which day is expanded/visible in the day-picker view.
  const initialMobileKey = useMemo(() => {
    const tKey = brusselsDayKey(new Date());
    const inWeek = days.some((d) => brusselsDayKey(new Date(d)) === tKey);
    return inWeek ? tKey : brusselsDayKey(new Date(days[0] ?? startMs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMs, endMs]);
  const [mobileDayKey, setMobileDayKey] = useState<string>(initialMobileKey);
  const activeMobileKey = days.some((d) => brusselsDayKey(new Date(d)) === mobileDayKey)
    ? mobileDayKey
    : initialMobileKey;
  const dayLongFmt = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    weekday: "long",
    day: "2-digit",
    month: "short",
  });

  return (
    <div className="flex-1 overflow-auto">
      {isFetching && totalEvents === 0 ? (
        <div className="p-4 text-xs text-muted-foreground">{t("common.loading")}</div>
      ) : null}

      {/* ============== MOBILE: single-day, stacked artists ============== */}
      <div className="sm:hidden">
        <div className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border bg-background px-2 py-2">
          {days.map((dayMs) => {
            const d = new Date(dayMs);
            const key = brusselsDayKey(d);
            const isActive = key === activeMobileKey;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMobileDayKey(key)}
                className={cn(
                  "flex min-w-[44px] shrink-0 flex-col items-center gap-0.5 rounded-md border px-2 py-1.5 text-xs",
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-foreground hover:bg-muted",
                  !isActive && isToday && "ring-1 ring-foreground/40",
                )}
              >
                <span className="text-[9px] uppercase tracking-wide opacity-70">
                  {dayFmt.format(d)}
                </span>
                <span className="text-sm font-semibold tabular-nums">{numFmt.format(d)}</span>
              </button>
            );
          })}
        </div>
        <div className="p-2">
          <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            {dayLongFmt.format(
              new Date(
                days.find((d) => brusselsDayKey(new Date(d)) === activeMobileKey) ?? startMs,
              ),
            )}
          </div>
          <div className="space-y-2">
            {agendas.map((a) => {
              const evs = a.events
                .filter((ev) => brusselsDayKey(new Date(ev.startTime)) === activeMobileKey)
                .sort(
                  (x, y) =>
                    new Date(x.startTime).getTime() - new Date(y.startTime).getTime(),
                );
              return (
                <div
                  key={a.staff.id}
                  className="rounded-md border border-border bg-background"
                >
                  <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-2 py-1.5">
                    <Avatar className="h-7 w-7 shrink-0">
                      {a.staff.avatarUrl ? (
                        <AvatarImage src={a.staff.avatarUrl} alt={a.staff.name} />
                      ) : null}
                      <AvatarFallback className={cn("text-[10px] text-white", a.staff.color)}>
                        {a.staff.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-foreground">
                        {a.staff.shortName}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {evs.length} {t("agenda.month.appts")}
                    </span>
                  </div>
                  {evs.length === 0 ? (
                    <div className="px-2 py-2 text-[11px] text-muted-foreground">—</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {evs.map((ev) => {
                        const bucket = statusMap.get(ev.id);
                        const name =
                          ev.contact?.name ||
                          [ev.contact?.firstName, ev.contact?.lastName]
                            .filter(Boolean)
                            .join(" ") ||
                          t("agenda.booked");
                        const s = new Date(ev.startTime).getTime();
                        return (
                          <div
                            key={ev.id}
                            className="flex items-center gap-2 px-2 py-1.5"
                            title={`${name}${ev.title ? " — " + ev.title : ""}`}
                          >
                            <span
                              className={cn(
                                "inline-block h-2 w-2 shrink-0 rounded-full",
                                a.staff.color,
                              )}
                              aria-hidden
                            />
                            <span className="w-10 shrink-0 text-xs tabular-nums text-muted-foreground">
                              {fmtHHmm(s)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                              {name}
                            </span>
                            {bucket ? (
                              <StatusBadge
                                variant={bucketToVariant(bucket)}
                                className="shrink-0 px-1 py-0 text-[9px]"
                              >
                                {bucketLabel(bucket)}
                              </StatusBadge>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {agendas.length === 0 && !isFetching ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                {t("common.loading")}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ============== DESKTOP: full 7-day grid ============== */}
      <div className="hidden min-w-[720px] sm:block">
        {/* Header row: sidebar spacer + 7 day headers */}
        <div className="sticky top-0 z-10 grid grid-cols-[160px_repeat(7,minmax(0,1fr))] border-b border-border bg-background">
          <div className="border-r border-border" />
          {days.map((dayMs) => {
            const d = new Date(dayMs);
            const key = brusselsDayKey(d);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPickDay(d)}
                className={cn(
                  "flex flex-col items-center gap-0.5 border-r border-border px-1 py-2 text-xs uppercase tracking-wide hover:bg-muted",
                  key === todayKey && "bg-muted",
                )}
              >
                <span className="text-[10px] text-muted-foreground">{dayFmt.format(d)}</span>
                <span className="text-sm font-semibold">{numFmt.format(d)}</span>
              </button>
            );
          })}
        </div>

        {/* Artist rows */}
        {agendas.map((a) => {
          const eventsByDay = new Map<string, GhlEvent[]>();
          for (const ev of a.events) {
            const k = brusselsDayKey(new Date(ev.startTime));
            const arr = eventsByDay.get(k) ?? [];
            arr.push(ev);
            eventsByDay.set(k, arr);
          }
          for (const arr of eventsByDay.values()) {
            arr.sort(
              (x, y) => new Date(x.startTime).getTime() - new Date(y.startTime).getTime(),
            );
          }
          return (
            <div
              key={a.staff.id}
              className="grid grid-cols-[160px_repeat(7,minmax(0,1fr))] border-b border-border"
            >
              {/* Sidebar */}
              <div
                className="flex items-center gap-2 border-r border-border bg-muted/30 px-3 py-2"
                title={a.staff.name}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  {a.staff.avatarUrl ? (
                    <AvatarImage src={a.staff.avatarUrl} alt={a.staff.name} />
                  ) : null}
                  <AvatarFallback className={cn("text-[10px] text-white", a.staff.color)}>
                    {a.staff.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-xs font-semibold text-foreground">
                    {a.staff.shortName}
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {a.events.length} {t("agenda.month.appts")}
                  </span>
                </div>
              </div>
              {/* Day cells */}
              {days.map((dayMs) => {
                const key = brusselsDayKey(new Date(dayMs));
                const evs = eventsByDay.get(key) ?? [];
                return (
                  <div
                    key={dayMs}
                    className={cn(
                      "min-h-[64px] space-y-1 border-r border-border p-1",
                      key === todayKey && "bg-muted/40",
                    )}
                  >
                    {evs.map((ev) => {
                      const bucket = statusMap.get(ev.id);
                      const name =
                        ev.contact?.name ||
                        [ev.contact?.firstName, ev.contact?.lastName]
                          .filter(Boolean)
                          .join(" ") ||
                        t("agenda.booked");
                      const s = new Date(ev.startTime).getTime();
                      return (
                        <div
                          key={ev.id}
                          title={`${name}${ev.title ? " — " + ev.title : ""}`}
                          className="overflow-hidden rounded border-l-2 border-foreground bg-background px-1 py-0.5 text-[10px] shadow-sm"
                        >
                          <div className="flex items-center gap-1 text-[9px] tabular-nums text-muted-foreground">
                            <span
                              className={cn(
                                "inline-block h-1.5 w-1.5 rounded-full",
                                a.staff.color,
                              )}
                              aria-hidden
                            />
                            {fmtHHmm(s)}
                          </div>
                          <div className="truncate font-semibold text-foreground">{name}</div>
                          {bucket ? (
                            <StatusBadge
                              variant={bucketToVariant(bucket)}
                              className="mt-0.5 px-1 py-0 text-[8px]"
                            >
                              {bucketLabel(bucket)}
                            </StatusBadge>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
        {agendas.length === 0 && !isFetching ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* =========================== MONTH VIEW =========================== */

function MonthView({
  date,
  restrictArtistId: _restrictArtistId,
  meReady,
  onPickDay,
}: {
  date: Date;
  restrictArtistId: string | null | undefined;
  meReady: boolean;
  onPickDay: (d: Date) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = resolveIntlLocale(i18n.language);

  const monthStart = brusselsMonthStartMs(date);
  const monthEnd = brusselsMonthEndMs(date);
  // Pad to start on Monday
  const gridStart = brusselsWeekStartMs(new Date(monthStart));
  const gridEndExclusive = brusselsAddDays(
    brusselsWeekStartMs(new Date(monthEnd)),
    7,
  );
  const days = enumerateBrusselsDays(gridStart, gridEndExclusive);

  // Show ALL artists in month view — calendar visibility is not restricted.
  const { agendas } = useStaffRangeAgenda(gridStart, gridEndExclusive - 1, {
    artistId: null,
    enabled: meReady,
  });
  const { map: statusMap } = useRangeAppointmentStatuses(
    gridStart,
    gridEndExclusive - 1,
    meReady,
  );

  type DayInfo = {
    events: GhlEvent[];
    artists: Array<{ staff: (typeof agendas)[number]["staff"]; count: number }>;
  };
  const infoByDay = useMemo(() => {
    const m = new Map<string, DayInfo>();
    for (const a of agendas) {
      const perDay = new Map<string, number>();
      for (const ev of a.events) {
        const key = brusselsDayKey(new Date(ev.startTime));
        perDay.set(key, (perDay.get(key) ?? 0) + 1);
        const info = m.get(key) ?? { events: [], artists: [] };
        info.events.push(ev);
        m.set(key, info);
      }
      for (const [key, count] of perDay) {
        const info = m.get(key)!;
        info.artists.push({ staff: a.staff, count });
      }
    }
    return m;
  }, [agendas]);

  const monthMs = brusselsMonthStartMs(date);
  const monthKey = brusselsDayKey(new Date(monthMs)).slice(0, 7);
  const todayKey = brusselsDayKey(new Date());
  const numFmt = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    day: "numeric",
  });
  const wdFmt = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    weekday: "short",
  });
  const wdNarrowFmt = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    weekday: "narrow",
  });

  const headerDays = days.slice(0, 7);

  return (
    <div className="flex-1 overflow-auto p-1 sm:p-2">
      <div className="grid grid-cols-7 border-b border-border text-[9px] uppercase tracking-wide text-muted-foreground sm:text-[10px]">
        {headerDays.map((d) => (
          <div key={d} className="px-1 py-1 text-center sm:px-2">
            <span className="sm:hidden">{wdNarrowFmt.format(new Date(d))}</span>
            <span className="hidden sm:inline">{wdFmt.format(new Date(d))}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-l border-t border-border">
        {days.map((dayMs) => {
          const d = new Date(dayMs);
          const key = brusselsDayKey(d);
          const inMonth = key.slice(0, 7) === monthKey;
          const info = infoByDay.get(key);
          const evs = info?.events ?? [];
          const artistsHere = info?.artists ?? [];
          const buckets = { paid: 0, pending: 0, error: 0 } as Record<string, number>;
          for (const ev of evs) {
            const b = statusMap.get(ev.id);
            if (b === "pago") buckets.paid++;
            else if (b === "a_receber") buckets.pending++;
            else if (b === "pendente") buckets.error++;
            else buckets.pending++;
          }
          const visibleArtists = artistsHere.slice(0, 3);
          const extraArtists = artistsHere.length - visibleArtists.length;
          const dominant: "paid" | "pending" | "error" | null =
            evs.length === 0
              ? null
              : buckets.error >= buckets.paid && buckets.error >= buckets.pending
                ? "error"
                : buckets.pending >= buckets.paid
                  ? "pending"
                  : "paid";
          const dotClass =
            dominant === "paid"
              ? "bg-emerald-500"
              : dominant === "error"
                ? "bg-red-500"
                : "bg-amber-500";
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPickDay(d)}
              className={cn(
                "flex min-h-[56px] flex-col items-start gap-1 border-b border-r border-border p-1 text-left transition-colors hover:bg-muted sm:min-h-[88px] sm:p-1.5",
                !inMonth && "bg-background/50 text-muted-foreground/60",
                key === todayKey && "ring-1 ring-foreground/40",
              )}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <span className="text-[11px] font-semibold sm:text-xs">{numFmt.format(d)}</span>
                {evs.length > 0 ? (
                  <span className="flex items-center gap-1 sm:hidden">
                    {dominant ? (
                      <span
                        className={cn("inline-block h-1.5 w-1.5 rounded-full", dotClass)}
                        aria-hidden
                      />
                    ) : null}
                    <span className="text-[10px] font-semibold tabular-nums text-foreground">
                      {evs.length}
                    </span>
                  </span>
                ) : null}
              </div>
              {artistsHere.length > 0 ? (
                <div className="hidden items-center gap-1 sm:flex">
                  <div className="flex -space-x-1.5">
                    {visibleArtists.map((entry) => (
                      <Avatar
                        key={entry.staff.id}
                        className="h-5 w-5 border border-background"
                        title={`${entry.staff.name} — ${entry.count}`}
                      >
                        {entry.staff.avatarUrl ? (
                          <AvatarImage src={entry.staff.avatarUrl} alt={entry.staff.name} />
                        ) : null}
                        <AvatarFallback
                          className={cn("text-[8px] text-white", entry.staff.color)}
                        >
                          {entry.staff.initials}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  {extraArtists > 0 ? (
                    <span className="text-[9px] font-semibold tabular-nums text-muted-foreground">
                      +{extraArtists}
                    </span>
                  ) : null}
                  <span className="ml-1 text-[10px] font-medium tabular-nums text-foreground">
                    {evs.length}
                  </span>
                </div>
              ) : null}
              {evs.length > 0 ? (
                <div className="mt-auto hidden flex-wrap gap-1 sm:flex">
                  {buckets.paid > 0 ? (
                    <StatusBadge variant="success" className="px-1 py-0 text-[9px]">
                      {buckets.paid}
                    </StatusBadge>
                  ) : null}
                  {buckets.pending > 0 ? (
                    <StatusBadge variant="warning" className="px-1 py-0 text-[9px]">
                      {buckets.pending}
                    </StatusBadge>
                  ) : null}
                  {buckets.error > 0 ? (
                    <StatusBadge variant="danger" className="px-1 py-0 text-[9px]">
                      {buckets.error}
                    </StatusBadge>
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}