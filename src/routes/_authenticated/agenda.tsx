import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MessageCircle,
  Bell,
  User,
  CalendarDays,
  Scissors,
  Plus,
  Star,
  Menu as MenuIcon,
  AlertTriangle,
  Bug,
} from "lucide-react";
import { toast } from "sonner";
import "@/i18n";

import { useStaffDayAgenda } from "@/hooks/use-agenda";
import { DEFAULT_START_HOUR, DEFAULT_END_HOUR, SLOT_MINUTES } from "@/lib/agenda-grid";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import gfSkull from "@/assets/gf-skull.png";
import { useCurrentUser } from "@/hooks/use-current-user";
import { UserMenu } from "@/components/auth/user-menu";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — GF Tattoo Studio" },
      { name: "description", content: "Agenda diária dos tatuadores" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    debug: s.debug === "1" || s.debug === 1 || s.debug === true,
  }),
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
  const navigate = useNavigate();
  const { debug } = Route.useSearch();
  const [date, setDate] = useState<Date>(() => new Date());
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: me } = useCurrentUser();
  const restrictArtistId = me?.role === "artist" ? me.artistId : null;
  const { agendas: allAgendas, isFetching } = useStaffDayAgenda(date);
  const agendas = restrictArtistId
    ? allAgendas.filter((a) => a.staff.id === restrictArtistId)
    : allAgendas;

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language === "pt" ? "pt-PT" : i18n.language, {
        timeZone: "Europe/Brussels",
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date),
    [date, i18n.language],
  );

  function shiftDay(delta: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d);
  }

  // Use longest slot list across staff so rows align; fall back to default 08–22.
  const rowCount = agendas.reduce((m, a) => Math.max(m, a.slots.length), 0);
  const timeColumn =
    rowCount > 0
      ? (agendas.find((a) => a.slots.length === rowCount)?.slots ?? []).map((s) => s.label)
      : defaultTimeLabels();

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-20">
      <Toaster theme="light" position="top-center" />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-1">
            <img
              src={gfSkull}
              alt="GF Tattoo Studio"
              width={28}
              height={28}
              className="mr-1 h-7 w-7 object-contain"
            />
            <button
              type="button"
              onClick={() => shiftDay(-1)}
              className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
              aria-label="Dia anterior"
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
              onClick={() => shiftDay(1)}
              className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
              aria-label="Próximo dia"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <IconBtn onClick={() => toast(t("actions.comingSoon"))} ariaLabel="Chat">
              <MessageCircle className="h-5 w-5" />
            </IconBtn>
            <IconBtn onClick={() => toast(t("actions.comingSoon"))} ariaLabel="Notificações">
              <Bell className="h-5 w-5" />
            </IconBtn>
            <UserMenu />
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pb-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setDate(new Date())}
            className="rounded-full border border-border bg-card px-3 py-1 text-[11px] uppercase tracking-wider hover:border-foreground hover:text-foreground"
          >
            {t("agenda.today")}
          </button>
          <span className="text-[11px]">
            {isFetching ? "…" : t("agenda.lastUpdate")}
          </span>
        </div>
      </header>

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
              <div className="mt-1">
                <div className="font-semibold">slots raw:</div>
                <pre className="whitespace-pre-wrap break-all">{a.debug?.slotsSample}</pre>
                <div className="mt-1 font-semibold">events raw:</div>
                <pre className="whitespace-pre-wrap break-all">{a.debug?.eventsSample}</pre>
              </div>
            </details>
          ))}
        </div>
      ) : null}

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <div className="flex min-w-full">
          {/* time column */}
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

          {/* staff columns */}
          <div className="flex flex-1">
            {agendas.map((a) => (
              <StaffColumn key={a.staff.id} agenda={a} />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-end justify-around border-t border-border bg-background/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
        <NavItem icon={<CalendarDays className="h-5 w-5" />} label={t("nav.agenda")} active />
        <NavItem icon={<Scissors className="h-5 w-5" />} label={t("nav.services")} onClick={() => toast(t("actions.comingSoon"))} />
        <button
          type="button"
          onClick={() => navigate({ to: "/appointments/new" })}
          aria-label={t("nav.new")}
          className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background"
        >
          <Plus className="h-7 w-7" />
        </button>
        <NavItem icon={<Star className="h-5 w-5" />} label={t("nav.reviews")} onClick={() => toast(t("actions.comingSoon"))} />
        <NavItem icon={<MenuIcon className="h-5 w-5" />} label={t("nav.menu")} onClick={() => toast(t("actions.comingSoon"))} />
      </nav>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] uppercase tracking-wider",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StaffColumn({ agenda }: { agenda: ReturnType<typeof useStaffDayAgenda>["agendas"][number] }) {
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
          <span
            title={error}
            className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-foreground"
          >
            <AlertTriangle className="h-3 w-3" /> {t("agenda.errorLoading")}
          </span>
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
          <div className="p-2 text-[10px] text-muted-foreground">
            <pre className="whitespace-pre-wrap break-all">{error}</pre>
          </div>
        ) : (
          slots.map((slot) => <SlotCell key={slot.startMs} slot={slot} />)
        )}
      </div>
    </div>
  );
}

function SlotCell({ slot }: { slot: import("@/lib/agenda-grid").GridSlot }) {
  const { t } = useTranslation();

  if (slot.status === "outside") {
    return <div className={cn("border-b border-border/30 bg-background/40", ROW_HEIGHT)} />;
  }

  if (slot.status === "free") {
    return (
      <div className={cn("border-b border-border/30 p-0.5", ROW_HEIGHT)}>
        <button
          type="button"
          onClick={() => toast(t("actions.comingSoon"))}
          className="flex h-full w-full flex-col items-center justify-center rounded border border-dashed border-border bg-background text-[10px] uppercase tracking-wider text-muted-foreground hover:border-foreground hover:text-foreground"
        >
          {t("agenda.noBooking")}
        </button>
      </div>
    );
  }

  // booked
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
      </div>
    </div>
  );
}