import { useTranslation } from "react-i18next";
import { enGB, fr, ptBR } from "react-day-picker/locale";
import { Calendar as CalendarIcon, Check, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { WizardSection } from "./wizard-layout";
import { formatHHmm } from "@/lib/agenda-grid";
import { resolveIntlLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";

export interface AgendaSessionPickerProps {
  sessionCount: number;
  sessionStarts: (string | null)[];
  activeSession: number;
  onSessionCountChange: (count: number) => void;
  onActiveSessionChange: (index: number) => void;
  date: Date;
  dateLabel: string;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onDateChange: (date: Date) => void;
  calendarSelected: boolean;
  slots: number[];
  slotsLoading: boolean;
  slotsError: string | null;
  onRetry: () => void;
  onPickSlot: (iso: string) => void;
}

/** Controlled UI only. Session dates and availability stay owned by the route. */
export function AgendaSessionPicker(props: AgendaSessionPickerProps) {
  const { t, i18n } = useTranslation();
  const locale = resolveIntlLocale(i18n.language);
  const calendarLocale = { "pt-PT": ptBR, "fr-FR": fr, "en-GB": enGB }[locale];
  const sessionLabel = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale, {
          timeZone: "Europe/Brussels",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(iso))
      : "Escolher data";

  return (
    <>
      <WizardSection title="Sessões do projeto">
        <div role="group" aria-label="Número de sessões" className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => props.onSessionCountChange(n)}
              aria-pressed={props.sessionCount === n}
              aria-label={`${n} ${n === 1 ? "sessão" : "sessões"}`}
              className={cn(
                "min-h-11 min-w-11 rounded-lg border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                props.sessionCount === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {n === 1 ? "Sessão única" : n}
            </button>
          ))}
        </div>
        {props.sessionCount > 1 ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">
              Cada sessão usa os mesmos serviços e valor. O total do projeto corresponde à soma das
              sessões.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: props.sessionCount }, (_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => props.onActiveSessionChange(i)}
                  aria-pressed={props.activeSession === i}
                  className={cn(
                    "flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    props.activeSession === i
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                      props.sessionStarts[i]
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {props.sessionStarts[i] ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      Sessão {i + 1}/{props.sessionCount}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {sessionLabel(props.sessionStarts[i] ?? null)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </WizardSection>
      <WizardSection
        title={`${t("appt.dateTime")}${props.sessionCount > 1 ? ` · Sessão ${props.activeSession + 1}` : ""}`}
      >
        <Popover open={props.pickerOpen} onOpenChange={props.onPickerOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 h-auto w-full justify-start whitespace-normal rounded-xl py-3 text-left sm:w-auto"
              aria-label={`Escolher data: ${props.dateLabel}`}
            >
              <CalendarIcon aria-hidden="true" className="h-4 w-4" />
              {props.dateLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              locale={calendarLocale}
              weekStartsOn={1}
              selected={props.date}
              onSelect={(date) => {
                if (date) props.onDateChange(date);
              }}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
          Horários de Bruxelas · Europe/Brussels
        </p>
        <div className="mt-4">
          {!props.calendarSelected ? (
            <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
              {t("appt.pickStaffFirst")}
            </p>
          ) : props.slotsLoading ? (
            <LoadingState inline size="sm" label={t("appt.loadingSlots")} />
          ) : props.slotsError !== null ? (
            <ErrorState
              description="Não foi possível carregar os horários."
              details={props.slotsError}
              onRetry={props.onRetry}
            />
          ) : props.slots.length === 0 ? (
            <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
              {t("appt.noSlots")}
            </p>
          ) : (
            <div
              role="group"
              aria-label={`Horários da sessão ${props.activeSession + 1}`}
              className="grid grid-cols-3 gap-2 min-[380px]:grid-cols-4 sm:grid-cols-6"
            >
              {props.slots.map((ms) => {
                const iso = new Date(ms).toISOString();
                const active = props.sessionStarts[props.activeSession] === iso;
                const usedElsewhere = props.sessionStarts.some(
                  (value, index) => index !== props.activeSession && value === iso,
                );
                return (
                  <button
                    type="button"
                    key={ms}
                    disabled={usedElsewhere}
                    onClick={() => props.onPickSlot(iso)}
                    aria-pressed={active}
                    aria-label={`${formatHHmm(ms)}${usedElsewhere ? ", reservado para outra sessão deste projeto" : ""}`}
                    className={cn(
                      "min-h-11 rounded-lg border px-2 py-2 text-sm font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background enabled:hover:bg-muted",
                    )}
                  >
                    {formatHHmm(ms)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </WizardSection>
    </>
  );
}
