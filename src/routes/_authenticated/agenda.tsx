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
import gfMark from "@/assets/gf-mark.png";
import { useCurrentUser } from "@/hooks/use-current-user";
import { resolveIntlLocale } from "@/lib/locale";
import { useAppointmentDraft } from "@/stores/appointment-draft";
import type { GhlEvent } from "@/lib/ghl";

type View = "day" | "week" | "month";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — GF Tattoo Studio" },
      { name: "description", content: "Agenda diária dos tatuadores" },
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

const COL_WIDTH = "min-w-[110px] w-[110px]";
const ROW_HEIGHT = "h-14";

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
    <div className="flex min-h-dvh flex-col bg-background pb-20">
      <Toaster theme="light" position="top-center" />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-1">
            <img
              src={gfMark}
              alt="GF Tattoo Studio"
              width={28}
              height={28}
              className="mr-1 h-7 w-7 object-contain"
            />
            <button
              type="button"
              onClick={() => shift(-1)}
              className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
              aria-label={t("agenda.prev")}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold uppercase tracking-wide hover:bg-muted"
                >
                  <CalendarIcon className="h-4 w-4 text-foreground" />
                  {dateLabel}
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
              className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
              aria-label={t("agenda.next")}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList className="h-8">
              <TabsTrigger value="day" className="text-xs">
                {t("agenda.view.day")}
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs">
                {t("agenda.view.week")}
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs">
                {t("agenda.view.month")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center justify-between px-4 pb-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setDate(new Date())}
            className="rounded-full border border-border bg-card px-3 py-1 text-[11px] uppercase tracking-wider hover:border-foreground hover:text-foreground"
          >
            {t("agenda.today")}
          </button>
          <span className="text-[11px]">{t("agenda.lastUpdate")}</span>
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
      <div className="flex-1 overflow-auto">
        <div className="flex min-w-full">
          <div className="sticky left-0 z-10 shrink-0 bg-background">
            <div className="h-16 border-b border-border" />
            {timeColumn.map((label) => (
              <div
                key={label}
                className={cn(
                  "flex w-14 items-start justify-center border-b border-border/40 pt-1 text-[10px] text-muted-foreground",
                  ROW_HEIGHT,
                )}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="flex flex-1">
            {agendas.map((a) => (
              <StaffColumn key={a.staff.id} agenda={a} statusMap={statusMap} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function StaffColumn({
  agenda,
  statusMap,
}: {
  agenda: ReturnType<typeof useStaffDayAgenda>["agendas"][number];
  statusMap: Map<string, PaymentBucket>;
}) {
  const { t } = useTranslation();
  const { staff, slots, isLoading, error } = agenda;

  return (
    <div className={cn("flex shrink-0 flex-col border-l border-border", COL_WIDTH)}>
      {/* Column header */}
      <div className="sticky top-0 z-10 flex h-16 flex-col items-center justify-center gap-1 border-b border-border bg-card px-1 py-2">
        <div className="flex items-center gap-1.5">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-muted text-[10px] font-bold text-foreground">
            {staff.initials}
          </div>
          <span className="truncate text-xs font-semibold">{staff.shortName}</span>
        </div>
        {error && agenda.slots.length === 0 ? (
          <StatusBadge
            variant="danger"
            title={error}
            icon={<AlertTriangle className="h-3 w-3" />}
          >
            {t("agenda.errorLoading")}
          </StatusBadge>
        ) : (
          <span className="text-[9px] text-muted-foreground">
            {agenda.bookedCount}● {agenda.freeCount}○
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
}: {
  slot: import("@/lib/agenda-grid").GridSlot;
  calendarId: string;
  statusMap: Map<string, PaymentBucket>;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const draft = useAppointmentDraft();

  if (slot.status === "outside") {
    return <div className={cn("border-b border-border/30 bg-background/40", ROW_HEIGHT)} />;
  }

  if (slot.status === "free") {
    return (
      <div className={cn("border-b border-border/30 p-0.5", ROW_HEIGHT)}>
        <button
          type="button"
          onClick={() => {
            draft.reset();
            draft.setCalendar(calendarId);
            draft.setStart(new Date(slot.startMs).toISOString());
            void navigate({ to: "/appointments/new" });
          }}
          className="flex h-full w-full flex-col items-center justify-center rounded border border-dashed border-border bg-background text-[10px] uppercase tracking-wider text-muted-foreground hover:border-foreground hover:text-foreground"
        >
          {t("agenda.noBooking")}
        </button>
      </div>
    );
  }

  // booked
  const bucket = slot.ghlEventId ? statusMap.get(slot.ghlEventId) : undefined;
  return (
    <div className={cn("border-b border-border/30 p-0.5", ROW_HEIGHT)}>
      <div
        title={`${slot.contactName ?? t("agenda.client")} — ${slot.serviceName ?? t("agenda.booked")}`}
        className="flex h-full w-full cursor-not-allowed flex-col justify-center rounded border-l-4 border-foreground bg-muted px-1.5 py-1 text-foreground"
      >
        <div className="truncate text-[10px] font-semibold text-foreground">
          {slot.contactName ?? t("agenda.booked")}
        </div>
        {slot.serviceName ? (
          <div className="truncate text-[9px] text-muted-foreground">{slot.serviceName}</div>
        ) : null}
        {bucket ? (
          <StatusBadge
            variant={bucketToVariant(bucket)}
            className="mt-0.5 self-start px-1 py-0 text-[9px]"
          >
            {bucketLabel(bucket)}
          </StatusBadge>
        ) : null}
      </div>
    </div>
  );
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