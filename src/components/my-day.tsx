import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { RefreshCw, ArrowUpRight } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { getMyDay } from "@/lib/my-day.functions";
import { MY_DAY_TZ, checkinState, type DayState } from "@/lib/my-day-core";
import { Button } from "@/components/ui/button";

const labels: Record<DayState, string> = {
  unverified: "Chegada não verificada",
  waiting: "Aguardando",
  in_progress: "Em atendimento",
  finished: "Atendimento concluído",
  absent: "Não compareceu · registrado",
  cancelled: "Check-in cancelado",
  conflict: "Vínculo a conferir",
};
const filters: { id: "all" | DayState; label: string }[] = [
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
export function MyDay() {
  const read = useServerFn(getMyDay);
  const [filter, setFilter] = useState<"all" | DayState>("all");
  const query = useQuery({
    queryKey: ["my-day-admin"],
    queryFn: () => read(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
  const data = query.data;
  return (
    <section aria-labelledby="my-day-heading" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="my-day-heading" className="text-xl font-semibold">
            Meu Dia — Central Operacional
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {data?.source ?? "Agenda e chegadas"}
            {data ? ` · ${time(data.updatedAt)}` : ""}
            {data ? ` · ${data.day.split("-").reverse().join("/")} · Bruxelas` : ""}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Atualizar Meu Dia"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw className={query.isFetching ? "animate-spin" : ""} />
        </Button>
      </div>
      {query.isError ? (
        <p role="alert" className="border-l-2 border-destructive pl-3 text-sm">
          Não foi possível conferir o dia.{" "}
          {data
            ? "A leitura anterior pode estar desatualizada."
            : "Agenda e chegadas indisponíveis."}
        </p>
      ) : null}
      {query.isPending ? (
        <p role="status" className="py-6 text-sm text-muted-foreground">
          Conferindo agenda e chegadas…
        </p>
      ) : null}
      {data ? (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-4 sm:grid-cols-5">
            {[
              ["Previstos", data.summary.expected],
              ["Chegaram", data.summary.arrived],
              ["Em atendimento", data.summary.inProgress],
              ["Concluídos", data.summary.finished],
              ["Não verificados", data.summary.unverified],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">
                  {value ?? "Indisponível"}
                </dd>
              </div>
            ))}
          </dl>
          {!data.coverage.appointments || !data.coverage.checkins ? (
            <p role="alert" className="text-sm text-destructive">
              {!data.coverage.appointments ? "Agenda local indisponível. " : ""}
              {!data.coverage.checkins
                ? "Chegadas indisponíveis; não é possível verificar comparecimento."
                : ""}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2" aria-label="Filtrar Meu Dia">
            {filters.map((f) => (
              <Button
                key={f.id}
                variant={filter === f.id ? "secondary" : "ghost"}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className="min-h-11"
              >
                {f.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {data.coverage.appointments
              ? `${data.rows.length} agendamentos no espelho local`
              : "Cobertura de agenda indisponível"}
          </p>
          <ul className="divide-y divide-border border-y border-border">
            {data.rows
              .filter(
                (r) =>
                  filter === "all" ||
                  r.state === filter ||
                  r.state === "conflict" ||
                  r.state === "absent" ||
                  r.state === "cancelled" ||
                  r.appointment.status === "cancelled" ||
                  r.appointment.status === "no_show",
              )
              .map((r) => (
                <li key={r.appointment.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-base font-semibold">
                        <span className="mr-3 tabular-nums text-primary">
                          {time(r.appointment.start)}
                        </span>
                        {r.appointment.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground break-words">
                        {r.appointment.artist ?? "Sem tatuador"}
                      </p>
                    </div>
                    <Button asChild size="icon" variant="ghost">
                      <Link
                        to="/agenda"
                        search={{ view: "day", novo: r.appointment.ghlId ?? undefined }}
                        aria-label={`Abrir agenda de ${r.appointment.name}`}
                      >
                        <ArrowUpRight />
                      </Link>
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Agenda: {agendaLabels[r.appointment.status] ?? "Situação a conferir"}
                  </p>
                  <p className="mt-2 text-sm">
                    Check-in: {data.coverage.checkins ? labels[r.state] : "Indisponível"}
                  </p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs sm:max-w-lg">
                    {[
                      ["Chegada", r.checkin?.arrived],
                      ["Início", r.checkin?.started],
                      ["Conclusão", r.checkin?.finished],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="mt-1 text-sm tabular-nums">{time(value ?? null)}</dd>
                      </div>
                    ))}
                  </dl>
                  {r.appointment.status === "cancelled" || r.appointment.status === "no_show" ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Agendamento:{" "}
                      {r.appointment.status === "cancelled"
                        ? "cancelado"
                        : "não compareceu · registrado"}
                    </p>
                  ) : null}
                </li>
              ))}
          </ul>
          {data.coverage.appointments &&
          !data.rows.some(
            (r) =>
              filter === "all" ||
              r.state === filter ||
              r.state === "conflict" ||
              r.state === "absent" ||
              r.state === "cancelled" ||
              r.appointment.status === "cancelled" ||
              r.appointment.status === "no_show",
          ) ? (
            <p className="py-4 text-sm text-muted-foreground">Nenhum agendamento nesta seleção.</p>
          ) : null}
          {data.unresolved.length ? (
            <div>
              <h3 className="text-base font-semibold">Chegada sem vínculo confirmado</h3>
              <ul className="mt-2 divide-y divide-border">
                {data.unresolved.map((c) => (
                  <li key={c.id} className="py-3">
                    <p className="break-words text-base">{c.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {time(c.arrived)} · {labels[checkinState(c.status)]}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
