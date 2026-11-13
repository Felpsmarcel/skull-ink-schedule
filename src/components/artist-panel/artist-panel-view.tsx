import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CircleHelp,
  Eye,
  Layers3,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatProjectDate, PROJECT_APPOINTMENT_STATUS } from "@/lib/project-journey-core";
import type { PanelAppointment } from "@/lib/artist-panel-core";
import type { getArtistPanel } from "@/lib/artist-panel.functions";

export type ArtistPanelData = Awaited<ReturnType<typeof getArtistPanel>>;
export type ArtistPanelDays = 30 | 60 | 90;
export type ArtistPanelDestination =
  | { kind: "home" }
  | { kind: "appointment"; ghlId: string | null; startAt: string }
  | { kind: "project"; projectId: string };
export type ArtistPanelLinkRenderer = (
  destination: ArtistPanelDestination,
  content: ReactNode,
  className: string,
) => ReactNode;

export interface ArtistPanelViewProps {
  data: ArtistPanelData;
  days: ArtistPanelDays;
  onArtistChange: (artistId: string) => void;
  onDaysChange: (days: ArtistPanelDays) => void;
  renderLink: ArtistPanelLinkRenderer;
}

const LINK_FOCUS =
  "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Read-only presentation. Authorization and data completeness remain server responsibilities. */
export function ArtistPanelView({
  data,
  days,
  onArtistChange,
  onDaysChange,
  renderLink,
}: ArtistPanelViewProps) {
  const projects = data.projects;
  const attention = projects?.filter((project) => project.continuity.future === 0) ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Acompanhamento do tatuador"
        title={data.artist.name}
        description="Agenda e continuidade dos projetos"
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
            <Eye aria-hidden="true" className="h-3.5 w-3.5" />{" "}
            {data.role === "admin" ? "Visão administrativa" : "Meu painel"}
          </span>
        }
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-28 pt-4 sm:px-6 sm:pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {renderLink(
            { kind: "home" },
            <>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Hoje no estúdio
            </>,
            `${LINK_FOCUS} inline-flex min-h-11 items-center gap-2 px-1 text-sm text-muted-foreground hover:text-foreground`,
          )}
          <p className="text-xs text-muted-foreground">Europe/Brussels</p>
        </div>

        <section
          aria-label="Selecionar tatuador e período"
          className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)] sm:p-5"
        >
          <label
            className={`min-w-0 space-y-2 text-xs font-medium text-muted-foreground ${data.role === "admin" ? "" : "hidden"}`}
          >
            <span className="block">Tatuador</span>
            <select
              aria-label="Tatuador"
              value={data.artist.id}
              className="min-h-11 w-full min-w-0 max-w-full rounded-xl border border-input bg-background px-3 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => onArtistChange(event.target.value)}
            >
              {data.artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 space-y-2 text-xs font-medium text-muted-foreground">
            <span className="block">Horizonte da agenda</span>
            <select
              aria-label="Horizonte da agenda"
              value={days}
              className="min-h-11 w-full min-w-0 max-w-full rounded-xl border border-input bg-background px-3 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => {
                const nextDays = Number(event.target.value);
                if (nextDays === 30 || nextDays === 60 || nextDays === 90) onDaysChange(nextDays);
              }}
            >
              {[30, 60, 90].map((value) => (
                <option key={value} value={value}>
                  Próximos {value} dias
                </option>
              ))}
            </select>
          </label>
        </section>

        <aside
          aria-label="Escopo dos dados"
          className="rounded-xl border border-border bg-muted/35 px-4 py-3 text-xs leading-5 text-muted-foreground"
        >
          <p className="font-medium text-foreground">
            {data.role === "admin"
              ? "Espelho local · visão do administrador"
              : "Espelho local · somente os seus agendamentos e projetos"}
          </p>
          <p className="mt-1">Não é a lista integral do GHL. Valores financeiros não aparecem aqui.</p>
          <p className="mt-1">Atualizado {formatProjectDate(data.updatedAt)} · Europe/Brussels.</p>
        </aside>

        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            icon={<CalendarDays aria-hidden="true" className="h-4 w-4" />}
            label="Agendamentos hoje"
            value={data.today?.length ?? null}
          />
          <Metric
            icon={<CalendarClock aria-hidden="true" className="h-4 w-4" />}
            label={`Próximos ${days} dias`}
            value={data.upcoming?.length ?? null}
          />
          <Metric
            icon={<Layers3 aria-hidden="true" className="h-4 w-4" />}
            label="Projetos ativos"
            value={projects?.length ?? null}
          />
          <Metric
            icon={<CircleHelp aria-hidden="true" className="h-4 w-4" />}
            label="Sem próxima data"
            value={
              projects && projects.every((project) => project.continuity.future !== null)
                ? (attention?.length ?? null)
                : null
            }
          />
        </dl>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <section
            aria-labelledby="artist-panel-today"
            className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
          >
            <SectionHeading
              id="artist-panel-today"
              title="Hoje"
              icon={<CalendarDays aria-hidden="true" className="h-5 w-5" />}
            />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Horário previsto não comprova presença ou início do atendimento.
            </p>
            <AppointmentList
              rows={data.today}
              empty="Nenhum agendamento local hoje."
              now
              renderLink={renderLink}
            />
          </section>
          <section
            aria-labelledby="artist-panel-upcoming"
            className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
          >
            <SectionHeading
              id="artist-panel-upcoming"
              title="Próximos compromissos"
              icon={<CalendarClock aria-hidden="true" className="h-5 w-5" />}
            />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Agendamentos locais a partir de amanhã, no período selecionado.
            </p>
            <div
              className="mt-3 max-h-96 overflow-y-auto overscroll-contain rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              tabIndex={0}
              role="region"
              aria-label="Lista de próximos compromissos"
            >
              <AppointmentList
                rows={data.upcoming}
                empty="Nenhum próximo compromisso neste período."
                renderLink={renderLink}
              />
            </div>
          </section>
        </div>

        <section aria-labelledby="artist-panel-projects" className="space-y-4">
          <div>
            <SectionHeading
              id="artist-panel-projects"
              title="Projetos e próximos retornos"
              icon={<Layers3 aria-hidden="true" className="h-5 w-5" />}
            />
            <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
              Agendamentos vinculados, não classificação automática de sessões de tatuagem.
              Coberturas confirmadas: a verificar — o tipo cadastrado pode ser um padrão não
              confirmado. Status comercial não verificado aqui.
            </p>
          </div>
          {projects === null ? (
            <Unavailable />
          ) : !projects.length ? (
            <EmptyState text="Nenhum projeto ativo local para este tatuador." />
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
                >
                  {renderLink(
                    { kind: "project", projectId: project.id },
                    <>
                      <span className="min-w-0 break-words">{project.title}</span>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                      />
                    </>,
                    `${LINK_FOCUS} flex min-h-11 items-start justify-between gap-3 py-1 text-base font-semibold hover:text-primary`,
                  )}
                  <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/45 p-3">
                    <ContinuityMetric label="Vinculados" value={project.continuity.linked} />
                    <ContinuityMetric
                      label="Conclusões registradas"
                      value={project.continuity.done}
                    />
                    <ContinuityMetric label="Futuros" value={project.continuity.future} />
                  </dl>
                  <div className="mt-4 flex items-start gap-2 text-sm">
                    <CalendarDays
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    />
                    <div className="min-w-0">
                      <p className="break-words font-medium">
                        {project.continuity.next
                          ? `Próxima data: ${formatProjectDate(project.continuity.next)}`
                          : project.continuity.future === null
                            ? "Continuidade indisponível"
                            : "Sem próximo agendamento"}
                      </p>
                      {!project.continuity.next ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Continuidade a verificar; não comprova abandono ou conclusão.
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {project.dates ? (
                    project.dates.length ? (
                      <div className="mt-4 border-t border-border pt-3">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Agendamentos vinculados
                        </p>
                        <ol className="space-y-2">
                          {project.dates.map((appointment) => (
                            <li
                              key={appointment.id}
                              className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs leading-5"
                            >
                              <span className="text-muted-foreground">
                                {formatProjectDate(appointment.startAt)}
                              </span>
                              <span>
                                {PROJECT_APPOINTMENT_STATUS[appointment.status] ?? "A verificar"}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : (
                      <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                        Nenhum agendamento local vinculado.
                      </p>
                    )
                  ) : (
                    <div className="mt-4">
                      <Unavailable />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

function AppointmentList({
  rows,
  empty,
  now = false,
  renderLink,
}: {
  rows: PanelAppointment[] | null;
  empty: string;
  now?: boolean;
  renderLink: ArtistPanelLinkRenderer;
}) {
  if (rows === null)
    return (
      <div className="mt-4">
        <Unavailable />
      </div>
    );
  if (!rows.length)
    return (
      <div className="mt-4">
        <EmptyState text={empty} />
      </div>
    );
  return (
    <ol className="mt-2 divide-y divide-border">
      {rows.map((appointment) => (
        <li key={appointment.id} className="py-3">
          {renderLink(
            { kind: "appointment", ghlId: appointment.ghlId, startAt: appointment.startAt },
            <>
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold">{appointment.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatProjectDate(appointment.startAt)}
                </p>
              </div>
              <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
            </>,
            `${LINK_FOCUS} flex min-h-11 items-center justify-between gap-3 px-1 hover:text-primary`,
          )}
          <p className="mt-2 px-1 text-xs leading-5 text-muted-foreground">
            {PROJECT_APPOINTMENT_STATUS[appointment.status] ?? "Status não verificado"}
            {now &&
            Date.parse(appointment.startAt) <= Date.now() &&
            Date.parse(appointment.endAt) > Date.now()
              ? " · No horário previsto"
              : ""}{" "}
            · Presença a verificar
          </p>
        </li>
      ))}
    </ol>
  );
}

function Metric({ label, value, icon }: { label: string; value: number | null; icon: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <dt className="text-xs leading-5 text-muted-foreground">
        <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-accent/65 text-primary">
          {icon}
        </span>
        {label}
      </dt>
      <dd
        className={`mt-2 break-words font-semibold tabular-nums ${value === null ? "text-base sm:text-lg" : "text-2xl sm:text-3xl"}`}
      >
        {value ?? "Indisponível"}
      </dd>
    </div>
  );
}
function ContinuityMetric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-4 text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 break-words font-medium tabular-nums ${value === null ? "text-xs" : "text-base"}`}
      >
        {value ?? "A verificar"}
      </dd>
    </div>
  );
}
function SectionHeading({ title, icon, id }: { title: string; icon: ReactNode; id: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 text-primary">{icon}</span>
      <h2 id={id} className="min-w-0 break-words font-editorial text-2xl">
        {title}
      </h2>
    </div>
  );
}
function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-muted/20 p-5 text-sm leading-6 text-muted-foreground">
      {text}
    </p>
  );
}
function Unavailable() {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm leading-6 text-muted-foreground"
    >
      <CircleHelp aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-warning" />
      <span>Fonte indisponível. Não representa zero.</span>
    </p>
  );
}

export function ArtistPanelLoading() {
  return (
    <>
      <PageHeader
        eyebrow="GF Tattoo Studio"
        title="Painel do tatuador"
        description="Acompanhamento administrativo"
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p
          role="status"
          className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground"
        >
          Carregando painel…
        </p>
      </main>
    </>
  );
}

export function ArtistPanelError({
  onRetry,
  homeLink,
}: {
  onRetry?: () => void;
  homeLink: ReactNode;
}) {
  return (
    <>
      <PageHeader
        eyebrow="GF Tattoo Studio"
        title="Painel do tatuador"
        description="Acompanhamento administrativo"
      />
      <main className="mx-auto max-w-xl px-4 py-8 pb-28">
        <section
          role="alert"
          className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <CircleHelp aria-hidden="true" className="h-6 w-6" />
          </span>
          <h2 className="mt-4 font-editorial text-2xl">Painel indisponível</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Disponível para administrador e para tatuadores com conta vinculada. Falhas de leitura
            também podem impedir a abertura.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {onRetry ? (
              <Button variant="outline" className="min-h-11 rounded-xl" onClick={onRetry}>
                <RefreshCw aria-hidden="true" className="h-4 w-4" /> Tentar novamente
              </Button>
            ) : null}
            {homeLink}
          </div>
        </section>
      </main>
    </>
  );
}
