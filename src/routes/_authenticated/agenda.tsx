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
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { resolveIntlLocale } from "@/lib/locale";
import { useAppointmentDraft } from "@/stores/appointment-draft";
import type { GhlEvent } from "@/lib/ghl";
import { AgendaAppointmentSheet } from "@/components/agenda-appointment-sheet";
import type { GridSlot } from "@/lib/agenda-grid";
import { AlertTriangle as AlertTriangleIcon } from "lucide-react";

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

const COL_WIDTH = "min-w-[120px] flex-1";
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
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
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

          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
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
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-[11px] font-bold uppercase tracking-widest sm:px-6">
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
                      "flex w-14 items-start justify-center border-b border-border/40 pt-1 text-[10px] font-medium text-muted-foreground",
                      ROW_HEIGHT,
                    )}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="relative flex flex-1">
                {agendas.map((a) => (
                  <StaffColumn
                    key={a.staff.id}
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
                ))}
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
    <div className={cn("flex shrink-0 flex-col border-l border-border", COL_WIDTH)}>
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
        className="absolute left-[3px] right-[3px] top-[2px] z-[1] flex flex-col justify-start gap-0.5 overflow-hidden rounded-md border border-border border-l-4 border-l-foreground bg-background px-2 py-1.5 text-left text-foreground shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-foreground/40"
        style={{ height: cardHeight }}
      >
        <div className="flex items-center gap-1">
          <span
            className="truncate text-[11px] uppercase leading-tight tracking-tight"
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
          <div className="truncate text-[10px] text-muted-foreground">{slot.serviceName}</div>
        ) : null}
        <div className="text-[10px] font-medium text-muted-foreground">
          {startLabel}
          {endLabel ? ` – ${endLabel}` : ""}
        </div>
        {bucket && cardHeight >= 56 ? (
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

const WEEK_HOURS = DEFAULT_END_HOUR - DEFAULT_START_HOUR;
const WEEK_PX_PER_HOUR = 48;

function WeekView({
  date,
  restrictArtistId,
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

  const { agendas, isFetching } = useStaffRangeAgenda(startMs, endMs, {
    artistId: restrictArtistId,
    enabled: meReady,
  });
  const { map: statusMap } = useRangeAppointmentStatuses(startMs, endMs, meReady);

  const allEvents = useMemo(() => agendas.flatMap((a) => a.events), [agendas]);

  const dayFmt = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    weekday: "short",
  });
  const numFmt = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    day: "2-digit",
  });

  const todayKey = brusselsDayKey(new Date());

  return (
    <div className="flex-1 overflow-auto">
      {isFetching && allEvents.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground">{t("common.loading")}</div>
      ) : null}
      <div className="grid min-w-[760px] grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-border">
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
      <div className="relative grid min-w-[760px] grid-cols-[56px_repeat(7,minmax(0,1fr))]">
        {/* hour column */}
        <div className="border-r border-border">
          {Array.from({ length: WEEK_HOURS }).map((_, i) => {
            const h = DEFAULT_START_HOUR + i;
            return (
              <div
                key={h}
                style={{ height: WEEK_PX_PER_HOUR }}
                className="flex items-start justify-center pt-1 text-[10px] text-muted-foreground"
              >
                {String(h).padStart(2, "0")}:00
              </div>
            );
          })}
        </div>
        {days.map((dayMs) => (
          <WeekDayColumn
            key={dayMs}
            dayStartMs={dayMs}
            events={allEvents.filter(
              (e) => brusselsDayKey(new Date(e.startTime)) === brusselsDayKey(new Date(dayMs)),
            )}
            statusMap={statusMap}
          />
        ))}
      </div>
    </div>
  );
}

function WeekDayColumn({
  dayStartMs: _dayStartMs,
  events,
  statusMap,
}: {
  dayStartMs: number;
  events: GhlEvent[];
  statusMap: Map<string, PaymentBucket>;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative border-r border-border">
      {Array.from({ length: WEEK_HOURS }).map((_, i) => (
        <div
          key={i}
          style={{ height: WEEK_PX_PER_HOUR }}
          className="border-b border-border/30"
        />
      ))}
      {events.map((ev) => {
        const s = new Date(ev.startTime).getTime();
        const e = new Date(ev.endTime).getTime();
        if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
        const [sh, sm] = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Brussels",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
          .format(new Date(s))
          .split(":")
          .map(Number);
        const startMin = sh * 60 + sm;
        const durMin = Math.max(15, Math.round((e - s) / 60000));
        const top = ((startMin - DEFAULT_START_HOUR * 60) / 60) * WEEK_PX_PER_HOUR;
        const height = (durMin / 60) * WEEK_PX_PER_HOUR;
        if (top + height <= 0 || top >= WEEK_HOURS * WEEK_PX_PER_HOUR) return null;
        const bucket = statusMap.get(ev.id);
        const name =
          ev.contact?.name ||
          [ev.contact?.firstName, ev.contact?.lastName].filter(Boolean).join(" ") ||
          t("agenda.booked");
        return (
          <div
            key={ev.id}
            title={`${name}${ev.title ? " — " + ev.title : ""}`}
            style={{ top, height: Math.max(height, 20) }}
            className="absolute left-0.5 right-0.5 overflow-hidden rounded border-l-4 border-foreground bg-muted px-1 py-0.5 text-[10px]"
          >
            <div className="truncate font-semibold">{name}</div>
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
}

/* =========================== MONTH VIEW =========================== */

function MonthView({
  date,
  restrictArtistId,
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

  const { agendas } = useStaffRangeAgenda(gridStart, gridEndExclusive - 1, {
    artistId: restrictArtistId,
    enabled: meReady,
  });
  const { map: statusMap } = useRangeAppointmentStatuses(
    gridStart,
    gridEndExclusive - 1,
    meReady,
  );

  const eventsByDay = useMemo(() => {
    const m = new Map<string, GhlEvent[]>();
    for (const a of agendas) {
      for (const ev of a.events) {
        const key = brusselsDayKey(new Date(ev.startTime));
        const arr = m.get(key) ?? [];
        arr.push(ev);
        m.set(key, arr);
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

  const headerDays = days.slice(0, 7);

  return (
    <div className="flex-1 overflow-auto p-2">
      <div className="grid grid-cols-7 border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
        {headerDays.map((d) => (
          <div key={d} className="px-2 py-1 text-center">
            {wdFmt.format(new Date(d))}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-l border-t border-border">
        {days.map((dayMs) => {
          const d = new Date(dayMs);
          const key = brusselsDayKey(d);
          const inMonth = key.slice(0, 7) === monthKey;
          const evs = eventsByDay.get(key) ?? [];
          const buckets = { paid: 0, pending: 0, error: 0 } as Record<string, number>;
          for (const ev of evs) {
            const b = statusMap.get(ev.id);
            if (b === "pago") buckets.paid++;
            else if (b === "a_receber") buckets.pending++;
            else if (b === "pendente") buckets.error++;
            else buckets.pending++;
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPickDay(d)}
              className={cn(
                "flex min-h-[88px] flex-col items-start gap-1 border-b border-r border-border p-1.5 text-left transition-colors hover:bg-muted",
                !inMonth && "bg-background/50 text-muted-foreground/60",
                key === todayKey && "ring-1 ring-foreground/40",
              )}
            >
              <span className="text-xs font-semibold">{numFmt.format(d)}</span>
              {evs.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] font-medium text-foreground">
                    {evs.length} {t("agenda.month.appts")}
                  </span>
                </div>
              ) : null}
              {evs.length > 0 ? (
                <div className="mt-auto flex flex-wrap gap-1">
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