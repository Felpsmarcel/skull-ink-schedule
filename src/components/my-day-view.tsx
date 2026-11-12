import { useId } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Info,
  RefreshCw,
  Timer,
  Users,
} from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import {
  MY_DAY_TZ,
  checkinState,
  type DayCheckin,
  type DayRow,
  type DayState,
} from "@/lib/my-day-core";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type MyDayFilter = "all" | DayState;
export interface MyDayData {
  rows: DayRow[];
  unresolved: DayCheckin[];
  summary: {
    expected: number | null;
    arrived: number | null;
    inProgress: number | null;
    finished: number | null;
    unverified: number | null;
  };
  coverage: { appointments: boolean; checkins: boolean };
  day: string;
  updatedAt: string;
  source: string;
}

const labels: Record<DayState, string> = {
  unverified: "Chegada não verificada",
  waiting: "Aguardando",
  in_progress: "Em atendimento",
  finished: "Atendimento concluído",
  absent: "Não compareceu · registrado",
  cancelled: "Check-in cancelado",
  conflict: "Vínculo a conferir",
};
const filters: { id: MyDayFilter; label: string }[] = [
  { id: "all", label: "Previstos" },
  { id: "waiting", label: "Aguardando" },
  { id: "in_progress", label: "Em atendimento" },
  { id: "finished", label: "Concluídos" },
  { id: "unverified", label: "Não verificados" },
  { id: "conflict", label: "A conferir" },
];
const agendaLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído · registrado",
  cancelled: "Cancelado · registrado",
  no_show: "Não compareceu · registrado",
};
const time = (iso: string | null) => (iso ? formatInTimeZone(iso, MY_DAY_TZ, "HH:mm") : "—");

function rowMatches(row: DayRow, filter: MyDayFilter) {
  return (
    filter === "all" ||
    row.state === filter ||
    row.state === "conflict" ||
    row.state === "absent" ||
    row.state === "cancelled" ||
    row.appointment.status === "cancelled" ||
    row.appointment.status === "no_show"
  );
}

/** Presentation only: counts, correlations and coverage always come from the read projection. */
export function MyDayView({
  data,
  filter,
  onFilterChange,
  isError,
  isPending,
  isFetching,
  onRefresh,
}: {
  data?: MyDayData;
  filter: MyDayFilter;
  onFilterChange: (filter: MyDayFilter) => void;
  isError: boolean;
  isPending: boolean;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  const headingId = useId();
  const visibleRows = data?.rows.filter((row) => rowMatches(row, filter)) ?? [];
  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-52">
          <h2 id={headingId} className="font-editorial text-2xl text-foreground sm:text-3xl">
            Agenda e chegadas
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {data
              ? `${data.day.split("-").reverse().join("/")} · Atualizado às ${time(data.updatedAt)} · Bruxelas`
              : "Acompanhe os horários e o andamento dos atendimentos."}
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-11 rounded-xl"
          aria-label="Atualizar Meu Dia"
          disabled={isFetching}
          onClick={onRefresh}
        >
          <RefreshCw
            className={cn("size-4", isFetching && "animate-spin motion-reduce:animate-none")}
            aria-hidden="true"
          />
          {isFetching ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>

      {isError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-semibold">Não foi possível conferir o dia.</p>
            <p className="mt-1 text-muted-foreground">
              {data
                ? "A leitura anterior pode estar desatualizada."
                : "Agenda e chegadas indisponíveis."}
            </p>
          </div>
        </div>
      ) : null}
      {isPending ? (
        <div aria-busy="true" aria-label="Conferindo agenda e chegadas" className="space-y-4">
          <p role="status" className="text-sm text-muted-foreground">
            Conferindo agenda e chegadas…
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl motion-reduce:animate-none" />
            ))}
          </div>
          <Skeleton className="h-60 rounded-2xl motion-reduce:animate-none" />
        </div>
      ) : null}

      {data ? (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Metric label="Previstos" value={data.summary.expected} icon={CalendarClock} />
            <Metric label="Chegaram" value={data.summary.arrived} icon={Users} />
            <Metric label="Em atendimento" value={data.summary.inProgress} icon={Timer} />
            <Metric label="Concluídos" value={data.summary.finished} icon={CheckCircle2} />
            <Metric label="Não verificados" value={data.summary.unverified} icon={CircleHelp} />
          </dl>

          <div className="rounded-2xl border border-border bg-card px-4 py-3">
            <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                {data.coverage.appointments
                  ? `${data.rows.length} agendamentos no espelho local`
                  : "Cobertura de agenda indisponível"}
                . A cobertura integral do GHL não está confirmada.
              </p>
            </div>
            <details className="group mt-2">
              <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-sm text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                Fonte e cobertura
                <ChevronDown
                  className="size-4 shrink-0 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-1 break-words border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                {data.source}
              </p>
            </details>
          </div>
          {!data.coverage.appointments || !data.coverage.checkins ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                {!data.coverage.appointments ? "Agenda local indisponível. " : ""}
                {!data.coverage.checkins
                  ? "Chegadas indisponíveis; não é possível verificar comparecimento."
                  : ""}
              </p>
            </div>
          ) : null}

          <div
            className="flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1.5"
            aria-label="Filtrar Meu Dia"
          >
            {filters.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                aria-pressed={filter === item.id}
                onClick={() => onFilterChange(item.id)}
                className={cn(
                  "min-h-11 rounded-xl px-3 text-xs sm:text-sm",
                  filter === item.id
                    ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Button>
            ))}
          </div>

          {visibleRows.length ? (
            <ul className="space-y-3">
              {visibleRows.map((row) => (
                <AppointmentCard
                  key={row.appointment.id}
                  row={row}
                  checkinsAvailable={data.coverage.checkins}
                />
              ))}
            </ul>
          ) : data.coverage.appointments ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-7 text-center">
              <CalendarClock
                className="mx-auto mb-3 size-6 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm font-medium">Nenhum agendamento nesta seleção.</p>
            </div>
          ) : null}

          {data.unresolved.length ? (
            <section
              aria-label="Chegada sem vínculo confirmado"
              className="overflow-hidden rounded-2xl border border-warning/30 bg-card"
            >
              <div className="flex items-start gap-3 border-b border-warning/20 bg-warning/10 p-4 sm:p-5">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
                <h3 className="text-base font-semibold">Chegada sem vínculo confirmado</h3>
              </div>
              <ul className="divide-y divide-border px-4 sm:px-5">
                {data.unresolved.map((checkin) => (
                  <li
                    key={checkin.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-4"
                  >
                    <p className="min-w-0 break-words text-sm font-semibold">{checkin.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="tabular-nums">{time(checkin.arrived)}</span> ·{" "}
                      {labels[checkinState(checkin.status)]}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | null;
  icon: typeof CalendarClock;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <Icon className="mb-3 size-4 text-primary/75" aria-hidden="true" />
      <dt className="text-xs leading-relaxed text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-2 text-foreground",
          value === null
            ? "break-words text-xs font-medium"
            : "font-editorial text-3xl tabular-nums",
        )}
      >
        {value ?? "Indisponível"}
      </dd>
    </div>
  );
}

function AppointmentCard({ row, checkinsAvailable }: { row: DayRow; checkinsAvailable: boolean }) {
  const exception =
    row.state === "conflict" ||
    row.state === "absent" ||
    row.state === "cancelled" ||
    row.appointment.status === "cancelled" ||
    row.appointment.status === "no_show";
  const checkinLabel = checkinsAvailable ? labels[row.state] : "Indisponível";
  const milestones = [
    { label: "Chegada", value: row.checkin?.arrived },
    { label: "Início", value: row.checkin?.started },
    { label: "Conclusão", value: row.checkin?.finished },
  ];
  return (
    <li
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm",
        exception ? "border-warning/40" : "border-border",
      )}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="shrink-0 rounded-xl border border-border bg-background px-3 py-2 text-center">
            <p className="text-[10px] font-medium text-muted-foreground">Horário</p>
            <p className="mt-1 font-editorial text-xl tabular-nums text-primary sm:text-2xl">
              {time(row.appointment.start)}
            </p>
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="break-words text-base font-semibold leading-snug text-foreground">
              {row.appointment.name}
            </h3>
            <p className="mt-1.5 break-words text-sm text-muted-foreground">
              {row.appointment.artist ?? "Sem tatuador"}
            </p>
          </div>
          <Button asChild size="icon" variant="outline" className="shrink-0 rounded-xl">
            <Link
              to="/agenda"
              search={{ view: "day", novo: row.appointment.ghlId ?? undefined }}
              aria-label={`Abrir agenda de ${row.appointment.name}`}
            >
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <p className="rounded-full border border-border bg-background px-3 py-1.5 text-muted-foreground">
            Agenda:{" "}
            <span className="font-medium text-foreground">
              {agendaLabels[row.appointment.status] ?? "Situação a conferir"}
            </span>
          </p>
          <p
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
              exception && checkinsAvailable
                ? "bg-warning/10 text-warning"
                : row.state === "unverified" || !checkinsAvailable
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/10 text-primary",
            )}
          >
            {exception && checkinsAvailable ? (
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
            ) : null}
            Check-in: <span className="font-medium">{checkinLabel}</span>
          </p>
        </div>
        {row.appointment.status === "cancelled" || row.appointment.status === "no_show" ? (
          <p className="mt-3 text-xs text-warning">
            Agendamento:{" "}
            {row.appointment.status === "cancelled" ? "cancelado" : "não compareceu · registrado"}
          </p>
        ) : null}
      </div>
      <dl className="grid grid-cols-3 border-t border-border bg-background/40 px-4 py-3 sm:px-5">
        {milestones.map(({ label, value }) => (
          <div
            key={label}
            className="relative min-w-0 pr-2 before:absolute before:left-2 before:right-0 before:top-1.5 before:h-px before:bg-border last:before:hidden"
          >
            <span
              className={cn(
                "relative z-10 mb-2 block size-3 rounded-full border-2",
                value ? "border-primary bg-primary" : "border-border bg-card",
              )}
              aria-hidden="true"
            />
            <dt className="text-[11px] text-muted-foreground sm:text-xs">{label}</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums">{time(value ?? null)}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}
