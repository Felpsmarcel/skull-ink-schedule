import type { ReactNode } from "react";
import { ArrowUpRight, CalendarDays, Layers3, Search, UserRound, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { formatEurCents } from "@/lib/project-progress-core";
import { formatProjectDate, projectContinuity } from "@/lib/project-journey-core";
import type { ProjectListItem } from "@/lib/projects.functions";

export interface ProjectsFilters {
  status: "active" | "completed" | "cancelled";
  artist?: string;
  q?: string;
}

export interface ProjectsViewProps {
  role: "admin" | "artist";
  items: ProjectListItem[];
  artists: { id: string; name: string | null }[];
  search: ProjectsFilters;
  hasMore: boolean;
  onSearchChange: (next: ProjectsFilters) => void;
  renderProjectLink: (item: ProjectListItem, content: ReactNode, className: string) => ReactNode;
}

const STATUS_LABEL = {
  active: "Em andamento",
  completed: "Concluídos",
  cancelled: "Cancelados",
} as const;

const PROJECT_STATUS_LABEL: Record<string, string> = {
  lead: "Novo projeto",
  quoted: "Orçado",
  scheduled: "Agendado",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

/** Presentation only. The route supplies already scoped results and navigation. */
export function ProjectsView({
  role,
  items,
  artists,
  search,
  hasMore,
  onSearchChange,
  renderProjectLink,
}: ProjectsViewProps) {
  const admin = role === "admin";
  const unassigned = admin ? items.filter((item) => !item.artistId) : [];
  const assigned = items.filter((item) => item.artistId || !admin);
  const filtered = Boolean(search.artist || search.q);

  function cards(projects: ProjectListItem[]) {
    return (
      <ul className="grid gap-4 lg:grid-cols-2">
        {projects.map((item) => (
          <li key={item.id} className="min-w-0">
            {renderProjectLink(
              item,
              <ProjectCardContent item={item} admin={admin} />,
              "group block h-full rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-5 motion-reduce:transition-none",
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="GF Tattoo Studio"
        title={admin ? "Projetos" : "Meus projetos"}
        description="Cada projeto, suas etapas e o próximo encontro."
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-28 pt-5 sm:px-6 sm:pt-6">
        <section
          aria-label="Filtrar projetos"
          className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4"
        >
          <div
            role="group"
            aria-label="Status do projeto"
            className="grid grid-cols-3 gap-1 rounded-xl bg-muted/65 p-1 sm:flex sm:w-fit"
          >
            {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((status) => (
              <Button
                key={status}
                type="button"
                variant={search.status === status ? "default" : "ghost"}
                aria-pressed={search.status === status}
                className="h-auto min-h-11 whitespace-normal rounded-lg px-2 py-2 text-xs sm:px-4 sm:text-sm"
                onClick={() => onSearchChange({ ...search, status })}
              >
                {STATUS_LABEL[status]}
              </Button>
            ))}
          </div>
          <div
            className={`mt-4 grid gap-3 ${admin ? "md:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)]" : ""}`}
          >
            <form
              role="search"
              aria-label="Buscar projetos"
              className="flex min-w-0 gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const value = new FormData(event.currentTarget).get("projectSearch");
                onSearchChange({
                  ...search,
                  q: typeof value === "string" ? value.trim() || undefined : undefined,
                });
              }}
            >
              <div className="relative min-w-0 flex-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"
                />
                <Input
                  key={search.q ?? ""}
                  name="projectSearch"
                  defaultValue={search.q ?? ""}
                  maxLength={100}
                  placeholder="Cliente ou projeto"
                  aria-label="Buscar cliente ou projeto"
                  className="min-h-11 rounded-xl bg-background pl-9"
                />
              </div>
              <Button type="submit" variant="outline" className="min-h-11 rounded-xl px-3">
                Buscar
              </Button>
            </form>
            {admin ? (
              <select
                aria-label="Tatuador"
                className="min-h-11 min-w-0 max-w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={search.artist ?? ""}
                onChange={(event) =>
                  onSearchChange({ ...search, artist: event.target.value || undefined })
                }
              >
                <option value="">Todos os tatuadores</option>
                {artists.map((artist) => (
                  <option key={artist.id} value={artist.id}>
                    {artist.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          {filtered ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
              <p className="min-w-0 break-words">Busca e filtros aplicados à lista.</p>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 text-xs"
                onClick={() => onSearchChange({ status: search.status })}
              >
                {admin ? "Limpar filtros" : "Limpar busca"}
              </Button>
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-medium">
            {items.length} {items.length === 1 ? "projeto nesta página" : "projetos nesta página"}
          </p>
          <p className="text-xs text-muted-foreground">Atualizados recentemente</p>
        </div>
        {hasMore ? (
          <p
            role="note"
            className="rounded-xl border border-border bg-muted/40 p-3 text-sm leading-6 text-muted-foreground"
          >
            A lista considera os 30 projetos mais recentes dos filtros de status e tatuador. A busca
            por texto se limita a essa seleção; há outros projetos fora desta página.
          </p>
        ) : null}

        {unassigned.length ? (
          <section
            aria-labelledby="unassigned-projects-title"
            className="space-y-3 rounded-2xl border border-warning/30 bg-warning/5 p-3 sm:p-4"
          >
            <div className="flex items-start gap-3">
              <UsersRound aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div>
                <h2 id="unassigned-projects-title" className="text-sm font-semibold">
                  Tatuador a definir
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Confira a ficha para organizar a continuidade destes projetos.
                </p>
              </div>
            </div>
            {cards(unassigned)}
          </section>
        ) : null}

        {assigned.length ? (
          <section aria-label={admin ? "Projetos por tatuador" : "Projetos do tatuador"}>
            {cards(assigned)}
          </section>
        ) : null}
        {!items.length ? (
          <section className="rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Layers3 aria-hidden="true" className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-editorial text-2xl">Nenhum projeto nesta seleção</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              {filtered
                ? "Tente outro nome ou limpe a busca e o filtro de tatuador."
                : "Escolha outro status para consultar os projetos disponíveis."}
            </p>
            {filtered ? (
              <Button
                type="button"
                variant="outline"
                className="mt-5 min-h-11 rounded-xl"
                onClick={() => onSearchChange({ status: search.status })}
              >
                {admin ? "Limpar filtros" : "Limpar busca"}
              </Button>
            ) : null}
          </section>
        ) : null}
      </main>
    </>
  );
}

function ProjectCardContent({ item, admin }: { item: ProjectListItem; admin: boolean }) {
  const next = projectContinuity(item.nextStartAt);
  const pct = item.sessionsTotal ? Math.round((item.sessionsDone / item.sessionsTotal) * 100) : 0;
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 rounded-full border border-border bg-muted/45 px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {PROJECT_STATUS_LABEL[item.status] ?? "Status a verificar"}
        </span>
        <ArrowUpRight
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary"
        />
      </div>
      <h3 className="mt-4 break-words text-lg font-semibold leading-snug">
        {item.clientName ?? "Cliente sem nome"}
      </h3>
      <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">{item.title}</p>
      {admin ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <UserRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 break-words">{item.artistName ?? "Tatuador a definir"}</span>
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
        <div className="text-xs leading-5 text-muted-foreground">
          <p>
            {item.sessionsTotal}{" "}
            {item.sessionsTotal === 1 ? "agendamento vinculado" : "agendamentos vinculados"}
          </p>
          <p>
            {item.sessionsDone}{" "}
            {item.sessionsDone === 1 ? "conclusão registrada" : "conclusões registradas"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {admin ? "Saldo do projeto" : "Sua parte"}
          </p>
          <p className="mt-1 break-words text-lg font-semibold tabular-nums text-foreground">
            {formatEurCents(admin ? item.balanceCents : item.artistShareCents)}
          </p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 flex items-start gap-2 text-sm">
        <CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="break-words font-medium">
            {next.startAt
              ? `Próximo agendamento: ${formatProjectDate(next.startAt)}`
              : "Sem próximo agendamento"}
          </p>
          {!next.startAt ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Continuidade a verificar; não indica conclusão ou abandono.
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
