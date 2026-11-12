import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { enGB, fr, ptBR } from "react-day-picker/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { resolveIntlLocale } from "@/lib/locale";
export type AgendaView = "day" | "week" | "month";
type Props = {
  date: Date;
  dateLabel: string;
  view: AgendaView;
  setView: (v: AgendaView) => void;
  pickerOpen: boolean;
  setPickerOpen: (v: boolean) => void;
  setDate: (d: Date) => void;
  goPrevMonth: () => void;
  shift: (n: number) => void;
  booked: number;
  free: number;
  summaryState: "ready" | "loading" | "partial";
  syncStatus?: ReactNode;
  allowArtistFilter: boolean;
  pickedArtistId: string;
  setPickedArtistId: (id: string) => void;
  allArtists: { id: string; name: string }[];
};
export function AgendaToolbar({
  date,
  dateLabel,
  view,
  setView,
  pickerOpen,
  setPickerOpen,
  setDate,
  goPrevMonth,
  shift,
  booked,
  free,
  summaryState,
  syncStatus,
  allowArtistFilter,
  pickedArtistId,
  setPickedArtistId,
  allArtists,
}: Props) {
  const { t, i18n } = useTranslation();
  const calendarLocale = { "pt-PT": ptBR, "fr-FR": fr, "en-GB": enGB }[
    resolveIntlLocale(i18n.language)
  ];
  return (
    <header
      aria-label="Agenda e filtros"
      className="sticky top-0 z-30 sm:top-[var(--gf-chrome-offset,0px)] border-b border-border bg-background"
    >
      <div className="mx-auto grid w-full max-w-[1400px] gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="flex min-w-0 items-center gap-2">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                aria-label={`Escolher data: ${dateLabel}`}
                className="h-auto min-h-14 min-w-0 flex-1 justify-start gap-2 rounded-xl px-2 py-2 text-left sm:flex-none"
              >
                <CalendarIcon aria-hidden="true" className="shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block whitespace-normal font-editorial text-xl font-semibold text-foreground first-letter:uppercase sm:text-2xl">
                    {dateLabel}
                  </span>
                  {view === "day" ? (
                    <span className="block text-xs font-normal tabular-nums text-muted-foreground">
                      {summaryState === "loading"
                        ? "Carregando agenda…"
                        : summaryState === "partial"
                          ? "Agenda parcial · confira os calendários"
                          : `${booked} agendamentos · ${free} horários livres`}
                      <span className="block mt-0.5">Horário de Bruxelas</span>
                    </span>
                  ) : null}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-auto p-0">
              <Calendar
                mode="single"
                locale={calendarLocale}
                weekStartsOn={1}
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
          {syncStatus}
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shift(-1)}
              className="h-11 w-11 shrink-0 text-muted-foreground"
              aria-label={t("agenda.prev")}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDate(new Date())}
              className="h-11 shrink-0 rounded-md border border-border px-4 text-sm font-medium text-foreground"
            >
              {t("agenda.today")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => shift(1)}
              className="h-11 w-11 shrink-0 text-muted-foreground"
              aria-label={t("agenda.next")}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
          {allowArtistFilter ? (
            <select
              aria-label="Selecionar tatuador"
              value={pickedArtistId}
              onChange={(e) => setPickedArtistId(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-[12rem]"
            >
              <option value="">Todos os tatuadores</option>
              {allArtists
                .filter((a) => !/augusto/i.test(a.name))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          ) : null}
        </div>
        <div
          role="group"
          aria-label="Visualização da agenda"
          className="grid grid-cols-3 rounded-lg border border-border bg-card p-1 sm:col-span-2 sm:justify-self-start xl:col-span-1 xl:justify-self-end"
        >
          {(["day", "week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "h-11 min-w-0 sm:min-w-[5rem] rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                view === v
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t(`agenda.view.${v}`)}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
