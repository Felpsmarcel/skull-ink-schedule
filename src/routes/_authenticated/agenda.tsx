import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  AlertTriangle,
  Bug,
  MoreHorizontal,
} from "lucide-react";
import "@/i18n";

import { useStaffDayAgenda, type StaffAgenda } from "@/hooks/use-agenda";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { resolveIntlLocale } from "@/lib/locale";
import { useAppointmentDraft } from "@/stores/appointment-draft";
import type { GhlEvent } from "@/lib/ghl";
import { AgendaAppointmentSheet } from "@/components/agenda-appointment-sheet";
import type { GridSlot } from "@/lib/agenda-grid";
import { AlertTriangle as AlertTriangleIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GhlSyncStatus } from "@/components/ghl-sync-status";
import { agendaScope } from "@/lib/agenda-scope";
import { useArtists } from "@/hooks/use-artists";

type View = "day" | "week" | "month";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    links: [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&display=swap" }],
    meta: [
      { title: "Agenda — GF Tattoo Studio" },
      { name: "description", content: "Sua agenda de atendimentos no GF Tattoo Studio." },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Agenda — GF Tattoo Studio" },
      { property: "og:description", content: "Agenda de atendimentos e atualização do CRM GF Tattoo Studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => {
    const on = s.debug === "1" || s.debug === 1 || s.debug === true || s.debug === "true";
    const rawView = typeof s.view === "string" ? s.view.toLowerCase() : undefined;
    const view: View | undefined =
      rawView === "week" || rawView === "month" || rawView === "day"
        ? (rawView as View)
        : undefined;
    const novo = typeof s.novo === "string" && s.novo.length > 2 ? s.novo : undefined;
    const out: { debug?: boolean; view?: View; novo?: string } = {};
    if (on) out.debug = true;
    if (view && view !== "day") out.view = view;
    if (novo) out.novo = novo;
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
  const search = Route.useSearch() as { debug?: boolean; view?: View; novo?: string };
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

  const { data: me, isPending: mePending } = useCurrentUser();
  const scope = agendaScope(me);
  const { data: allArtists = [] } = useArtists();
  const [pickedArtistId, setPickedArtistId] = useState<string>("");
  // Admin may narrow to one artist; artist scope is never widened.
  const restrictArtistId = scope.artistId ?? (pickedArtistId || null);
  const { agendas } = useStaffDayAgenda(date, {
    artistId: restrictArtistId,
    enabled: scope.allowed && Boolean(me) && view === "day",
  });
  const totals = useMemo(() => agendas.reduce(
    (sum, a) => ({ booked: sum.booked + a.bookedCount, free: sum.free + a.freeCount }),
    { booked: 0, free: 0 },
  ), [agendas]);

  function goPrevMonth() {
    const d = new Date(date);
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    setDate(d);
    setView("month");
  }

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

  if (!scope.allowed) return <div role="status" className="p-6 text-muted-foreground">{mePending ? "A carregar…" : "Acesso à agenda não autorizado: vínculo não verificado."}</div>;

  return (
    <div className="agenda-scope flex min-h-dvh flex-col bg-background pb-[calc(env(safe-area-inset-bottom)+6rem)] sm:pb-20">
      {/* Header — editorial monochrome */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-[1400px] gap-1 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.25rem)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-6 sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label={`Escolher data: ${dateLabel}`}
                  className="min-w-0 flex-1 justify-start gap-2 px-0 text-left sm:flex-none sm:px-2"
                >
                  <CalendarIcon aria-hidden="true" className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                  <span
                    className="block font-editorial text-xl font-semibold text-foreground first-letter:uppercase sm:text-2xl"
                  >
                    {dateLabel}
                  </span>
                  {view === "day" ? (
                    <span className="block text-xs font-normal tabular-nums text-muted-foreground">
                      {t("agenda.kpi.sessions", { n: totals.booked })}
                      <span aria-hidden="true"> · </span>
                      {totals.free === 0 ? "Nenhum horário vago" : t("agenda.kpi.free", { n: totals.free })}
                    </span>
                  ) : null}
                  </span>
                </Button>
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
                <div className="border-t border-border p-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      goPrevMonth();
                      setPickerOpen(false);
                    }}
                    className="w-full justify-start px-2 text-sm text-muted-foreground"
                  >
                    Ir para o mês anterior
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            {me?.role === "admin" ? <GhlSyncStatus /> : null}
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <div className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shift(-1)}
              className="shrink-0 text-muted-foreground"
              aria-label={t("agenda.prev")}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDate(new Date())}
              className="shrink-0 px-2 text-sm font-medium text-primary"
            >
              {t("agenda.today")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shift(1)}
              className="shrink-0 text-muted-foreground"
              aria-label={t("agenda.next")}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
            </div>
            {scope.artistId === null ? (
              <select
                aria-label="Selecionar tatuador"
                value={pickedArtistId}
                onChange={(e) => setPickedArtistId(e.target.value)}
                className="h-11 min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-[12rem]"
              >
                <option value="">Todos</option>
                {allArtists.filter((a) => !/augusto/i.test(a.name)).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : null}

            {/* Mobile-only compact view switch */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("agenda.view.week") + " / " + t("agenda.view.month")}
                  className="ml-auto shrink-0 text-muted-foreground sm:hidden"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="z-50 w-40 p-1">
                {view !== "day" ? (
                  <Button
                    variant="ghost"
                    onClick={() => setView("day")}
                    className="w-full justify-start px-2 font-normal"
                  >
                    {t("agenda.view.day")}
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  onClick={() => setView("week")}
                  className={cn(
                    "w-full justify-start px-2 font-normal",
                    view === "week" && "bg-muted",
                  )}
                >
                  {t("agenda.view.week")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setView("month")}
                  className={cn(
                    "w-full justify-start px-2 font-normal",
                    view === "month" && "bg-muted",
                  )}
                >
                  {t("agenda.view.month")}
                </Button>
              </PopoverContent>
            </Popover>
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as View)}
            className="hidden shrink-0 sm:block"
          >
            <TabsList className="h-9 rounded-lg bg-muted p-1">
              <TabsTrigger
                value="day"
                className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                {t("agenda.view.day")}
              </TabsTrigger>
              <TabsTrigger
                value="week"
                className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                {t("agenda.view.week")}
              </TabsTrigger>
              <TabsTrigger
                value="month"
                className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                {t("agenda.view.month")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          </div>
        </div>
      </header>

      {view === "day" ? (
        <DayView
          date={date}
          agendas={agendas}
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
  agendas,
  meReady,
  debug,
}: {
  date: Date;
  agendas: StaffAgenda[];
  meReady: boolean;
  debug: boolean;
}) {
  const { t } = useTranslation();
  const daySearch = Route.useSearch() as { novo?: string };

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

  const chipAgendas = agendas.filter((a) => !/augusto/i.test(a.staff.shortName) && !/^gf( tattoo)?$/i.test(a.staff.shortName.trim()));

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

  // Next upcoming appointment across all artists (today only)
  const nextEventInfo = useMemo(() => {
    const now = Date.now();
    const isToday = brusselsDayKey(new Date(now)) === brusselsDayKey(date);
    if (!isToday) return { id: null as string | null, startMs: null as number | null };
    let bestId: string | null = null;
    let bestStart = Number.POSITIVE_INFINITY;
    for (const a of agendas) {
      for (const s of a.slots) {
        if (s.status !== "booked" || !s.isFirstSlot || !s.ghlEventId) continue;
        const start = s.eventStartMs ?? s.startMs;
        if (start > now && start < bestStart) {
          bestStart = start;
          bestId = s.ghlEventId;
        }
      }
    }
    return { id: bestId, startMs: bestId ? bestStart : null };
  }, [agendas, date]);

  // Auto-scroll to next event (or "now") once per date
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didAutoScrollRef = useRef(false);
  const autoScrollAtRef = useRef(0);
  const dayKey = brusselsDayKey(date);
  useEffect(() => {
    didAutoScrollRef.current = false;
  }, [dayKey]);
  useEffect(() => {
    if (didAutoScrollRef.current) return;
    if (rowCount === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    let targetPx: number | null = null;
    if (nextEventInfo.startMs != null) {
      const dayStartMs = brusselsDayStartMs(date);
      const offsetMin =
        (nextEventInfo.startMs - dayStartMs) / 60000 - DEFAULT_START_HOUR * 60;
      targetPx = Math.max(0, (offsetMin / SLOT_MINUTES) * ROW_HEIGHT_PX);
    } else if (nowTopPx != null) {
      targetPx = nowTopPx;
    }
    if (targetPx == null) return;
    autoScrollAtRef.current = Date.now();
    el.scrollTo({ top: Math.max(0, targetPx - 80), behavior: "auto" });
    didAutoScrollRef.current = true;
  }, [rowCount, nextEventInfo.startMs, nowTopPx, date]);

  return (
    <>
      {debug ? (
        <div className="border-b border-border bg-card/50 p-2 text-xs text-muted-foreground">
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

      {/* Mobile-only artist chip selector */}
      {chipAgendas.length > 1 ? (
        <div className="border-b border-border bg-background sm:hidden">
          <div className="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chipAgendas.map((a) => {
              const active = a.staff.id === effectiveActiveId;
              return (
                <Button
                  key={a.staff.id}
                  variant="ghost"
                  aria-pressed={active}
                  onClick={() => setActiveStaffId(a.staff.id)}
                  className={cn(
                    "shrink-0 gap-2 rounded-md border px-3 text-sm font-medium",
                    active
                      ? "border-primary/60 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <span className="truncate max-w-[140px]">{a.staff.shortName}</span>
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      active ? "opacity-80" : a.bookedCount === 0 ? "opacity-40" : "",
                    )}
                    aria-label={`${a.bookedCount} sessões`}
                  >
                    {a.bookedCount}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Grid card */}
      <div className="mx-auto w-full max-w-[1400px] flex-1 px-2 py-4 sm:px-6">
        <div className="h-full overflow-hidden border-y border-border bg-background">
          <div ref={scrollRef} className="h-full overflow-auto">
            <div className="relative flex w-full min-w-full">
              {/* Time column */}
              <div className="sticky left-0 z-10 shrink-0 border-r border-border bg-card">
                <div className="h-16 border-b border-border" />
                {timeColumn.map((label) => (
                  <div
                    key={label}
                    className={cn(
                      "flex w-12 items-start justify-center border-b border-border/40 pt-1 text-xs font-medium tabular-nums text-muted-foreground sm:w-14 sm:text-xs",
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
                        nextEventId={nextEventInfo.id}
                        highlightEventId={daySearch.novo ?? null}


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
                    <span className="ml-1 rounded-sm bg-primary px-1 py-[1px] text-xs font-semibold tabular-nums text-primary-foreground">
                      {nowLabel}
                    </span>
                    <div className="h-px flex-1 bg-primary" />
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
  nextEventId,
  highlightEventId = null,
  onOpen,
}: {
  agenda: ReturnType<typeof useStaffDayAgenda>["agendas"][number];
  statusMap: Map<string, PaymentBucket>;
  nextEventId: string | null;
  highlightEventId?: string | null;
  onOpen: (slot: GridSlot) => void;
}) {

  const { t } = useTranslation();
  const { staff, slots, isLoading, error } = agenda;

  return (
    <div className={cn("flex flex-col border-l border-border", COL_WIDTH)}>
      {/* Column header — editorial */}
      <div className="sticky top-0 z-10 flex h-16 flex-col items-center justify-center gap-0.5 border-b border-border bg-muted/40 px-2 py-2 text-center">
        <span
          className="truncate text-sm font-medium leading-tight text-foreground"
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
          <span className="text-xs text-muted-foreground">
            {t("agenda.staff.summary", {
              booked: agenda.bookedCount,
              free: agenda.freeCount,
              count: agenda.bookedCount,
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
              isNext={Boolean(nextEventId && slot.ghlEventId === nextEventId)}
              isHighlighted={Boolean(highlightEventId && slot.ghlEventId === highlightEventId)}
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
  isNext,
  isHighlighted,
  onOpen,
}: {
  slot: import("@/lib/agenda-grid").GridSlot;
  calendarId: string;
  statusMap: Map<string, PaymentBucket>;
  isNext?: boolean;
  isHighlighted?: boolean;
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
        <Button
          variant="ghost"
          onClick={() => {
            draft.reset();
            draft.setCalendar(calendarId);
            draft.setStart(new Date(slot.startMs).toISOString());
            void navigate({ to: "/appointments/new" });
          }}
          aria-label={t("agenda.addSlot")}
          title={t("agenda.addSlot")}
          className="h-full w-full rounded-md border border-dashed border-primary/30 bg-transparent text-xs font-medium text-primary hover:border-primary/60 hover:bg-primary/5 hover:text-primary"
        >
          + {t("agenda.addSlot")}
        </Button>
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
      <Button
        variant="ghost"
        data-appointment-status={slot.appointmentStatus?.toLowerCase()}
        onClick={() => onOpen(slot)}
        title={`${slot.contactName ?? t("agenda.client")} — ${slot.serviceName ?? t("agenda.booked")}`}
        className={cn(
          "agenda-session absolute left-[3px] right-[3px] top-[2px] z-[1] h-auto flex-col items-stretch justify-start gap-0.5 overflow-hidden whitespace-normal rounded-md border border-border border-l-[3px] px-2 py-1 text-left text-foreground hover:bg-accent/40 focus-visible:ring-ring sm:py-1.5",
          isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}

        style={{ height: cardHeight }}
      >
        {isNext ? (
          <span className="pointer-events-none absolute right-1 top-1 rounded-sm bg-primary/15 px-1 py-[1px] text-xs font-medium text-primary">
            {t("agenda.next", { defaultValue: "Próximo" })}
          </span>
        ) : null}
        <div className="flex items-center gap-1">
          <span
            className={cn("truncate text-sm font-medium leading-tight", isNext && "pr-14")}
          >
            {slot.contactName ?? t("agenda.booked")}
          </span>
          {slot.hasOverlap ? (
            <AlertTriangleIcon
              className="h-3 w-3 shrink-0 text-agenda-warning"
              aria-label={t("agenda.details.overlap")}
            />
          ) : null}
        </div>
        {slot.serviceName && cardHeight >= 84 ? (
          <div className="line-clamp-2 text-xs font-normal leading-tight text-muted-foreground">{slot.serviceName}</div>
        ) : null}
        <div className="text-xs font-medium tabular-nums text-muted-foreground">
          {startLabel}
          {endLabel ? ` – ${endLabel}` : ""}
        </div>
        {bucket && cardHeight >= 84 ? (
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

  // Same verified artist scope in all three modes.
  const { agendas, isFetching } = useStaffRangeAgenda(startMs, endMs, {
    artistId: restrictArtistId,
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

  const [openEvent, setOpenEvent] = useState<{
    slot: GridSlot;
    staffName: string;
    calendarId: string;
  } | null>(null);

  const openFromEvent = (
    ev: GhlEvent,
    staff: (typeof agendas)[number]["staff"],
  ) => {
    const s = new Date(ev.startTime).getTime();
    const e = new Date(ev.endTime).getTime();
    const name =
      ev.contact?.name ||
      [ev.contact?.firstName, ev.contact?.lastName].filter(Boolean).join(" ") ||
      undefined;
    const slot: GridSlot = {
      startMs: s,
      label: fmtHHmm(s),
      status: "booked",
      contactName: name,
      contactId: ev.contactId ?? ev.contact?.id,
      ghlEventId: ev.id,
      appointmentStatus: ev.appointmentStatus,
      eventStartMs: s,
      eventEndMs: e,
      isFirstSlot: true,
      spanSlots: 1,
      serviceName: ev.title,
    };
    setOpenEvent({ slot, staffName: staff.name, calendarId: staff.calendarId });
  };

  const tooltipTimeFmt = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex-1 overflow-auto">
      {isFetching && totalEvents === 0 ? (
        <div className="p-4 text-xs text-muted-foreground">{t("common.loading")}</div>
      ) : null}

      {/* ============== MOBILE: artists × 7 days grid ============== */}
      <div className="sm:hidden">
        <div
          className="grid border-b border-border bg-background"
          style={{ gridTemplateColumns: "44px repeat(7, minmax(0, 1fr))" }}
        >
          {/* header row */}
          <div className="sticky left-0 z-10 border-b border-r border-border bg-background" />
          {days.map((dayMs) => {
            const d = new Date(dayMs);
            const key = brusselsDayKey(d);
            const isToday = key === todayKey;
            return (
              <div
                key={`h-${key}`}
                className={cn(
                  "flex flex-col items-center gap-0.5 border-b border-l border-border px-0.5 py-1.5 text-center",
                  isToday && "bg-primary/10",
                )}
              >
                <span
                  className={cn(
                    "text-[11px] tracking-wide text-muted-foreground",
                    isToday && "text-primary",
                  )}
                >
                  {dayFmt.format(d).replace(".", "")}
                </span>
                <span
                  className={cn(
                    "text-[13px] font-semibold tabular-nums leading-none",
                    isToday ? "text-primary" : "text-foreground",
                  )}
                >
                  {numFmt.format(d)}
                </span>
              </div>
            );
          })}

          {/* artist rows */}
          {agendas.map((a) => {
            const byDay = new Map<string, GhlEvent[]>();
            for (const ev of a.events) {
              const k = brusselsDayKey(new Date(ev.startTime));
              const list = byDay.get(k);
              if (list) list.push(ev);
              else byDay.set(k, [ev]);
            }
            for (const list of byDay.values()) {
              list.sort(
                (x, y) =>
                  new Date(x.startTime).getTime() - new Date(y.startTime).getTime(),
              );
            }
            return (
              <div key={a.staff.id} className="contents">
                <div className="sticky left-0 z-10 flex flex-col items-center justify-center gap-1 border-b border-r border-border bg-background px-0.5 py-2">
                  <Avatar className="h-8 w-8 shrink-0 border border-border">
                    {a.staff.avatarUrl ? (
                      <AvatarImage src={a.staff.avatarUrl} alt={a.staff.name} />
                    ) : null}
                    <AvatarFallback className="bg-muted text-xs text-foreground">
                      {a.staff.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="line-clamp-2 text-center text-[11px] font-semibold tracking-tight leading-tight text-foreground">
                    {a.staff.shortName}
                  </span>
                </div>
                {days.map((dayMs) => {
                  const d = new Date(dayMs);
                  const key = brusselsDayKey(d);
                  const isToday = key === todayKey;
                  const evs = byDay.get(key) ?? [];
                  const visible = evs.slice(0, 3);
                  const extra = evs.length - visible.length;
                  return (
                    <div
                      key={`${a.staff.id}-${key}`}
                      className={cn(
                        "flex min-h-[64px] flex-col gap-0.5 border-b border-l border-border p-0.5",
                        isToday && "bg-primary/5",
                      )}
                    >
                      {visible.map((ev) => {
                        const s = new Date(ev.startTime).getTime();
                        const name =
                          ev.contact?.name ||
                          [ev.contact?.firstName, ev.contact?.lastName]
                            .filter(Boolean)
                            .join(" ") ||
                          t("agenda.booked");
                        return (
                          <Button
                            variant="ghost"
                            data-appointment-status={ev.appointmentStatus?.toLowerCase()}
                            key={ev.id}
                            type="button"
                            onClick={() => openFromEvent(ev, a.staff)}
                            title={`${name}${ev.title ? " — " + ev.title : ""}`}
                            className="agenda-session h-11 min-w-0 gap-0 overflow-hidden rounded-sm border border-border border-l-2 px-0 text-xs font-medium tabular-nums text-foreground"
                          >
                            <span className="py-1">{fmtHHmm(s)}</span>
                          </Button>
                        );
                      })}
                      {extra > 0 ? (
                        <span className="px-1 text-[11px] font-medium text-muted-foreground">
                          +{extra}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        {agendas.length === 0 && !isFetching ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : null}
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
                  "flex flex-col items-center gap-0.5 border-r border-border px-1 py-2 text-xs tracking-wide hover:bg-muted",
                  key === todayKey && "bg-primary/10 text-primary",
                )}
              >
                <span className="text-xs text-muted-foreground">{dayFmt.format(d)}</span>
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
                  <AvatarFallback className="bg-muted text-xs text-foreground">
                    {a.staff.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-xs font-semibold text-foreground">
                    {a.staff.shortName}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
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
                      key === todayKey && "bg-primary/5",
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
                      const e = new Date(ev.endTime).getTime();
                      return (
                        <Tooltip key={ev.id}>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              data-appointment-status={ev.appointmentStatus?.toLowerCase()}
                              onClick={() => openFromEvent(ev, a.staff)}
                              className="agenda-session h-auto min-h-11 w-full flex-col items-stretch gap-1 overflow-hidden whitespace-normal rounded-sm border border-border border-l-2 px-2 py-2 text-left text-xs font-normal hover:bg-accent/40"
                            >
                              <div className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
                                <span
                                  className={cn(
                                    "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                                    "bg-primary",
                                  )}
                                  aria-hidden
                                />
                                <span className="truncate">{fmtHHmm(s)}</span>
                              </div>
                              <div className="truncate font-semibold text-foreground">
                                {name}
                              </div>
                              {bucket ? (
                                <StatusBadge
                                  variant={bucketToVariant(bucket)}
                                  className="mt-0.5 self-start px-1 py-0 text-xs normal-case"
                                >
                                  {bucketLabel(bucket)}
                                </StatusBadge>
                              ) : null}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[240px]">
                            <div className="flex flex-col gap-0.5">
                              <div className="text-[11px] font-semibold">
                                {tooltipTimeFmt.format(new Date(s))}–
                                {tooltipTimeFmt.format(new Date(e))}
                              </div>
                              <div className="text-[11px]">{name}</div>
                              {ev.title ? (
                                <div className="text-xs opacity-80 line-clamp-2">
                                  {ev.title}
                                </div>
                              ) : null}
                              <div className="mt-1 text-[11px] tracking-wide opacity-70">
                                {a.staff.shortName}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
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
    <AgendaAppointmentSheet
      open={Boolean(openEvent)}
      onOpenChange={(o) => {
        if (!o) setOpenEvent(null);
      }}
      slot={openEvent?.slot ?? null}
      staffName={openEvent?.staffName ?? ""}
      calendarId={openEvent?.calendarId ?? ""}
      bucket={
        openEvent?.slot.ghlEventId
          ? statusMap.get(openEvent.slot.ghlEventId)
          : undefined
      }
    />
    </TooltipProvider>
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

  // Same verified artist scope in all three modes.
  const { agendas } = useStaffRangeAgenda(gridStart, gridEndExclusive - 1, {
    artistId: restrictArtistId,
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
  const monthTimeFmt = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const headerDays = days.slice(0, 7);

  return (
    <div className="flex-1 overflow-auto p-1 sm:p-2">
      <div className="grid grid-cols-7 border-b border-border text-[11px] tracking-wide text-muted-foreground sm:text-xs">
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
              ? "bg-success"
              : dominant === "error"
                ? "bg-destructive"
                : "bg-agenda-warning";
          const sortedEvs = [...evs].sort(
            (x, y) =>
              new Date(x.startTime).getTime() - new Date(y.startTime).getTime(),
          );
          const summaryLines = sortedEvs.slice(0, 8).map((ev) => {
            const nm =
              ev.contact?.name ||
              [ev.contact?.firstName, ev.contact?.lastName]
                .filter(Boolean)
                .join(" ") ||
              t("agenda.booked");
            return `${monthTimeFmt.format(new Date(ev.startTime))} · ${nm}`;
          });
          const extraLines = sortedEvs.length - summaryLines.length;
          const dayTitle =
            summaryLines.length > 0
              ? summaryLines.join("\n") +
                (extraLines > 0 ? `\n+${extraLines}` : "")
              : undefined;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPickDay(d)}
              title={dayTitle}
              className={cn(
                "flex min-h-[56px] flex-col items-start gap-1 border-b border-r border-border p-1 text-left transition-colors hover:bg-muted sm:min-h-[88px] sm:p-1.5",
                !inMonth && "bg-background/50 text-muted-foreground/60",
                key === todayKey && "bg-primary/5 ring-1 ring-inset ring-primary/60",
              )}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <span className={cn("text-sm font-semibold tabular-nums", key === todayKey && "text-primary")}>{numFmt.format(d)}</span>
                {evs.length > 0 ? (
                  <span className="flex items-center gap-1 sm:hidden">
                    {dominant ? (
                      <span
                        className={cn("inline-block h-1.5 w-1.5 rounded-full", dotClass)}
                        aria-hidden
                      />
                    ) : null}
                    <span className="text-xs font-semibold tabular-nums text-foreground">
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
                          className="bg-muted text-[10px] text-foreground"
                        >
                          {entry.staff.initials}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  {extraArtists > 0 ? (
                    <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                      +{extraArtists}
                    </span>
                  ) : null}
                  <span className="ml-1 text-xs font-medium tabular-nums text-foreground">
                    {evs.length}
                  </span>
                </div>
              ) : null}
              {evs.length > 0 ? (
                <div className="mt-auto hidden flex-wrap gap-1 sm:flex">
                  {buckets.paid > 0 ? (
                    <StatusBadge variant="success" className="px-1 py-0 text-[11px]">
                      {buckets.paid}
                    </StatusBadge>
                  ) : null}
                  {buckets.pending > 0 ? (
                    <StatusBadge variant="warning" className="px-1 py-0 text-[11px]">
                      {buckets.pending}
                    </StatusBadge>
                  ) : null}
                  {buckets.error > 0 ? (
                    <StatusBadge variant="danger" className="px-1 py-0 text-[11px]">
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