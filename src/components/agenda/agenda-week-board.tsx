import { useState } from "react";
import { CalendarDays, Plus, Clock, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { brusselsDayKey, formatHHmm } from "@/lib/agenda-grid";
import {
  appointmentState,
  valueEvent,
  agendaMoney,
  entryDay,
  entryName,
  type AgendaEntry,
  type AgendaReadState,
} from "@/lib/agenda-presentation";
import { RANDEVU_CALENDAR_ID } from "@/lib/artist-commission-policy";
import { agendaValueForEvent, type AgendaValuesSource } from "@/lib/agenda-values-core";
import { StatusBadge } from "@/components/ui/status-badge";

export function AgendaWeekBoard({
  days,
  entries,
  state,
  source,
  showValues,
  onOpen,
  onPickDay,
  onNew,
  onRetry,
  todayKey = brusselsDayKey(new Date()),
}: {
  days: number[];
  entries: AgendaEntry[];
  state: AgendaReadState;
  source: AgendaValuesSource;
  showValues: boolean;
  onOpen: (entry: AgendaEntry) => void;
  onPickDay: (date: Date) => void;
  onNew?: (date: Date) => void;
  onRetry?: () => void;
  todayKey?: string;
}) {
  const keys = days.map((ms) => brusselsDayKey(new Date(ms)));
  const [selected, setSelected] = useState(todayKey);
  const selectedKey = keys.includes(selected) ? selected : keys[0];
  const dayLabel = (ms: number, long = false) =>
    new Intl.DateTimeFormat("pt-PT", {
      timeZone: "Europe/Brussels",
      weekday: long ? "long" : "short",
      day: "2-digit",
      ...(long ? { month: "long" as const } : {}),
    }).format(new Date(ms));
  return (
    <section
      aria-label="Agenda semanal"
      className="mx-auto w-full max-w-[1600px] px-3 pb-8 sm:px-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 py-4">
        <h2 className="text-lg font-semibold text-foreground">Sua semana, sessão por sessão</h2>
        <span className="text-sm text-muted-foreground">
          Selecione um compromisso para abrir a ficha.
        </span>
      </div>
      {state !== "ready" && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
        >
          <span>
            {state === "loading"
              ? "Carregando os calendários…"
              : "A leitura dos calendários está incompleta ou tem divergências. Os valores do período ficam a conferir."}
          </span>
          {state === "partial" && onRetry && (
            <button
              type="button"
              className="min-h-11 text-primary underline underline-offset-4"
              onClick={onRetry}
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}
      <div
        className="mb-4 grid grid-cols-7 gap-1 lg:hidden"
        role="group"
        aria-label="Dia da semana"
      >
        {days.map((ms, i) => (
          <button
            key={ms}
            type="button"
            aria-label={dayLabel(ms, true)}
            aria-pressed={selectedKey === keys[i]}
            onClick={() => setSelected(keys[i])}
            className={cn(
              "min-h-16 min-w-0 rounded-xl border px-1 py-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selectedKey === keys[i]
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground",
            )}
          >
            <span className="block text-xs capitalize">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][i]}
            </span>
            <span className="block text-lg font-semibold tabular-nums">{keys[i].slice(-2)}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-7 lg:gap-2">
        {days.map((ms, i) => {
          const key = keys[i],
            list = entries.filter((entry) => entryDay(entry) === key);
          return (
            <section
              key={ms}
              aria-label={dayLabel(ms, true)}
              className={cn("min-w-0", key !== selectedKey && "hidden lg:block")}
            >
              <div
                className={cn(
                  "mb-3 flex min-h-16 items-center justify-between gap-2 border-b px-1 pb-2",
                  key === todayKey
                    ? "border-primary text-primary"
                    : "border-border text-foreground",
                )}
              >
                <button
                  type="button"
                  onClick={() => onPickDay(new Date(ms))}
                  aria-label={`Abrir agenda de ${dayLabel(ms, true)}`}
                  className="min-h-11 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block text-xs font-medium capitalize">
                    {new Intl.DateTimeFormat("pt-PT", {
                      timeZone: "Europe/Brussels",
                      weekday: "long",
                    }).format(new Date(ms))}
                  </span>
                  <span className="text-2xl font-semibold tabular-nums">{key.slice(-2)}</span>
                  {key === todayKey && <span className="ml-2 text-xs">Hoje</span>}
                </button>
                <span
                  className="text-sm tabular-nums text-muted-foreground"
                  aria-label={`${list.length} compromissos`}
                >
                  {list.length}
                </span>
              </div>
              <div className="space-y-3">
                {list.map((entry) => (
                  <AgendaWeekEntry
                    key={`${entry.staff.calendarId}:${entry.event.id}`}
                    entry={entry}
                    source={source}
                    showValues={showValues}
                    onOpen={onOpen}
                  />
                ))}
                {list.length === 0 && (
                  <div className="flex min-h-32 flex-col items-center justify-center gap-2 px-2 text-center text-sm text-muted-foreground">
                    <CalendarDays aria-hidden="true" className="h-5 w-5" />
                    <span>
                      {state === "ready"
                        ? "Nenhum compromisso exibido"
                        : state === "loading"
                          ? "Leitura em andamento"
                          : "Calendário a conferir"}
                    </span>
                  </div>
                )}
              </div>
              {onNew && (
                <button
                  type="button"
                  onClick={() => onNew(new Date(ms))}
                  className="mt-3 flex min-h-11 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border px-2 text-sm font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Ver horários
                </button>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function AgendaWeekEntry({
  entry,
  source,
  showValues,
  onOpen,
}: {
  entry: AgendaEntry;
  source: AgendaValuesSource;
  showValues: boolean;
  onOpen: (entry: AgendaEntry) => void;
}) {
  const meta = entry.issue
    ? { label: "Dados a conferir", tone: "warning" as const, excluded: false }
    : appointmentState(entry.event.appointmentStatus);
  const consultation = entry.staff.calendarId === RANDEVU_CALENDAR_ID;
  const item = showValues && !entry.issue ? agendaValueForEvent(valueEvent(entry), source) : null;
  const difference =
    item?.totalCents != null && item.depositCents != null && item.depositCents <= item.totalCents
      ? item.totalCents - item.depositCents
      : null;
  const start = Date.parse(entry.event.startTime),
    end = Date.parse(entry.event.endTime);
  const minutes = Number.isFinite(end) && end > start ? Math.round((end - start) / 60000) : null;
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="group w-full min-w-0 rounded-xl border border-border bg-card p-3 text-left text-foreground transition-colors hover:border-primary/60 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${entryName(entry)}, ${formatHHmm(start)}, ${entry.staff.shortName}, ${meta.label}, abrir ficha`}
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <span className="text-base font-semibold tabular-nums">{formatHHmm(start)}</span>
        <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <StatusBadge
        variant={meta.tone}
        className="mb-2 max-w-full whitespace-normal rounded-md px-1.5 py-0.5 text-[11px] normal-case"
      >
        {meta.label}
      </StatusBadge>
      <span className="block break-words text-sm font-semibold leading-snug">
        {entryName(entry)}
      </span>
      <span className="mt-1 block break-words text-xs leading-relaxed text-muted-foreground">
        {entry.event.title || "Descrição não informada"}
      </span>
      <span className="mt-3 block break-words text-xs font-medium text-foreground">
        {entry.staff.shortName}
      </span>
      {minutes != null && (
        <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock aria-hidden="true" className="h-3 w-3" />
          {minutes >= 60
            ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ""}`
            : `${minutes}min`}
        </span>
      )}
      {consultation ? (
        <span className="mt-3 block text-xs font-medium text-primary">Randevu · orçamento</span>
      ) : showValues && !meta.excluded ? (
        <span className="mt-3 block border-t border-border pt-2 text-xs leading-relaxed">
          <span className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-1">
            <span className="text-muted-foreground">Valor</span>
            <span className="whitespace-nowrap text-right font-medium tabular-nums">
              {agendaMoney(item?.totalCents)}
            </span>
          </span>
          <span className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-1">
            <span className="text-muted-foreground">Sinal informado</span>
            <span className="whitespace-nowrap text-right tabular-nums">
              {agendaMoney(item?.depositCents)}
            </span>
          </span>
          <span className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-1">
            <span className="text-muted-foreground">Diferença</span>
            <span className="whitespace-nowrap text-right tabular-nums">
              {agendaMoney(difference)}
            </span>
          </span>
          {item?.projectId && <span className="mt-2 block text-primary">Projeto vinculado</span>}
        </span>
      ) : null}
    </button>
  );
}
