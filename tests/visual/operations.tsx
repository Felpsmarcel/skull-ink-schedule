import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createRouter,
  createRootRoute,
  createRoute,
  createMemoryHistory,
  RouterProvider,
  Outlet,
  Link,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthShell } from "../../src/components/layout/auth-shell";
import { AgendaToolbar, type AgendaView } from "../../src/components/agenda/agenda-toolbar";
import { AgendaBookingCard } from "../../src/components/agenda/agenda-booking-card";
import { ProjectsView, type ProjectsFilters } from "../../src/components/projects/projects-view";
import type { ProjectListItem } from "../../src/lib/projects.functions";
import { Button } from "../../src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../../src/components/ui/dialog";
import type { GridSlot } from "../../src/lib/agenda-grid";
import "../../src/i18n";
import "./visual.css";
const artists = [
  { id: "example-a", name: "Artista Exemplo A" },
  { id: "example-b", name: "Artista Exemplo B" },
  { id: "example-r", name: "Randevu · Exemplo" },
];
export function AgendaDemo() {
  const [date, setDate] = useState(new Date("2026-11-12T12:00:00+01:00"));
  const [view, setView] = useState<AgendaView>("day");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [artist, setArtist] = useState("");
  const [source, setSource] = useState<"ready" | "loading" | "partial">("ready");
  const [opened, setOpened] = useState<GridSlot | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const dateLabel = new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Brussels",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
  const shift = (n: number) => setDate(new Date(date.getTime() + n * 86400000));
  return (
    <>
      <AgendaToolbar
        date={date}
        dateLabel={dateLabel}
        view={view}
        setView={setView}
        pickerOpen={pickerOpen}
        setPickerOpen={setPickerOpen}
        setDate={setDate}
        goPrevMonth={() => {
          shift(-30);
          setView("month");
        }}
        shift={shift}
        booked={artist ? 1 : 3}
        free={4}
        summaryState={source}
        allowArtistFilter
        pickedArtistId={artist}
        setPickedArtistId={setArtist}
        allArtists={artists}
      />
      <main className="mx-auto max-w-[1400px] space-y-5 px-3 py-5 pb-28 sm:px-6">
        <p
          role="note"
          className="rounded-xl border border-primary/20 bg-accent/50 p-4 text-sm leading-6"
        >
          Prévia de revisão · Clientes e horários fictícios. Componentes reais de filtros e cartões.
          Sem conexão com GHL. A grade abaixo é demonstrativa.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Estado da fonte (teste):</span>
          {(["ready", "loading", "partial"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={source === s ? "default" : "outline"}
              onClick={() => setSource(s)}
            >
              {{ ready: "Carregada", loading: "Carregando", partial: "Parcial" }[s]}
            </Button>
          ))}
          <Link
            to="/projetos"
            className="ml-auto inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-primary underline"
          >
            Ver projetos
          </Link>
        </div>
        {view !== "day" ? (
          <div role="status" className="rounded-xl border border-border bg-card p-6">
            Controle {view === "week" ? "Semana" : "Mês"} selecionado. A grade completa desse modo
            será validada no app; esta prévia demonstra os cartões diários.
          </div>
        ) : null}
        <div className="grid gap-5 md:grid-cols-3">
          {artists
            .filter((a) => !artist || a.id === artist)
            .map((a) => {
              const i = artists.findIndex((item) => item.id === a.id);
              const start = Date.parse("2026-11-12T09:00:00Z") + i * 3600000;
              const slot: GridSlot = {
                startMs: start,
                label: "10:00",
                status: "booked",
                isFirstSlot: true,
                spanSlots: i === 2 ? 2 : 4,
                contactName:
                  i === 2
                    ? "Cliente de orçamento (fictício)"
                    : `Cliente Exemplo ${i + 1} (fictício)`,
                serviceName:
                  i === 2 ? "Orçamento · Randevu" : "Projeto de cobertura · etapa de exemplo",
                eventStartMs: start,
                eventEndMs: start + (i === 2 ? 3600000 : 7200000),
                appointmentStatus: i === 1 ? "cancelled" : "confirmed",
              };
              return (
                <section
                  key={a.id}
                  className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                >
                  <header className="border-b border-border px-4 py-4">
                    <h2 className="font-semibold">{a.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Agenda ilustrativa · horário de Bruxelas
                    </p>
                  </header>
                  <div className="p-3">
                    <AgendaBookingCard
                      slot={slot}
                      onOpen={(next) => {
                        opener.current = document.activeElement as HTMLElement;
                        setOpened(next);
                      }}
                    />
                    <div aria-hidden className={i === 2 ? "h-14" : "h-42"} />
                    <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                      Horários livres de exemplo
                    </div>
                  </div>
                </section>
              );
            })}
        </div>
        <Dialog
          open={!!opened}
          onOpenChange={(o) => {
            if (!o) setOpened(null);
          }}
        >
          <DialogContent
            closeLabel="Fechar"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              opener.current?.focus();
            }}
          >
            <DialogTitle>{opened?.contactName}</DialogTitle>
            <DialogDescription>
              {opened?.serviceName}. Exemplo de abertura do cartão; nenhum agendamento real foi
              acessado ou alterado.
            </DialogDescription>
            <Button onClick={() => setOpened(null)}>Voltar à agenda</Button>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
const projectExamples: ProjectListItem[] = [
  {
    id: "demo-project-a",
    title: "Cobertura das costas · Projeto fictício",
    status: "in_progress",
    clientName: "Cliente Exemplo 1",
    artistId: "example-a",
    artistName: "Artista Exemplo A",
    sessionsTotal: 3,
    sessionsDone: 1,
    nextStartAt: "2026-12-15T09:00:00Z",
    balanceCents: 120000,
    artistShareCents: 35000,
  },
  {
    id: "demo-project-b",
    title: "Reforma do braço · Projeto fictício",
    status: "quoted",
    clientName: "Cliente Exemplo 2",
    artistId: "example-b",
    artistName: "Artista Exemplo B",
    sessionsTotal: 2,
    sessionsDone: 0,
    nextStartAt: null,
    balanceCents: null,
    artistShareCents: null,
  },
  {
    id: "demo-project-c",
    title: "Cobertura com planejamento de etapas · Projeto fictício",
    status: "lead",
    clientName: "Cliente Exemplo 3",
    artistId: null,
    artistName: null,
    sessionsTotal: 0,
    sessionsDone: 0,
    nextStartAt: null,
    balanceCents: null,
    artistShareCents: null,
  },
];
export function ProjectsDemo() {
  const [search, setSearch] = useState<ProjectsFilters>({ status: "active" });
  const [role, setRole] = useState<"admin" | "artist">("admin");
  const [hasMore, setHasMore] = useState(false);
  const [opened, setOpened] = useState<ProjectListItem | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const items = projectExamples.filter(
    (item) =>
      search.status === "active" &&
      (role === "admin" || item.artistId === "example-a") &&
      (!search.artist || search.artist === item.artistId) &&
      (!search.q ||
        `${item.clientName} ${item.title}`
          .toLocaleLowerCase()
          .includes(search.q.toLocaleLowerCase())),
  );
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <div
          role="note"
          className="rounded-xl border border-primary/20 bg-accent/50 p-4 text-sm leading-6"
        >
          Prévia de revisão · Clientes e valores fictícios. Lista real de projetos com dados de
          exemplo. Sem conexão com GHL.
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={role === "admin" ? "default" : "outline"}
              onClick={() => {
                setRole("admin");
                setSearch({ status: "active" });
              }}
            >
              Ver como administração
            </Button>
            <Button
              size="sm"
              variant={role === "artist" ? "default" : "outline"}
              onClick={() => {
                setRole("artist");
                setSearch({ status: "active" });
              }}
            >
              Ver como tatuador
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-pressed={hasMore}
              onClick={() => setHasMore(!hasMore)}
            >
              Simular lista parcial
            </Button>
          </div>
        </div>
      </div>
      <ProjectsView
        role={role}
        items={items}
        artists={artists.slice(0, 2)}
        search={search}
        hasMore={hasMore}
        onSearchChange={setSearch}
        renderProjectLink={(item, content, className) => (
          <button
            type="button"
            className={`${className} w-full text-left`}
            onClick={(event) => {
              opener.current = event.currentTarget;
              setOpened(item);
            }}
          >
            {content}
          </button>
        )}
      />
      <Dialog
        open={!!opened}
        onOpenChange={(open) => {
          if (!open) setOpened(null);
        }}
      >
        <DialogContent
          closeLabel="Fechar"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
        >
          <DialogTitle>{opened?.clientName}</DialogTitle>
          <DialogDescription>
            {opened?.title}. Demonstração da abertura do cartão; nenhum projeto real foi acessado ou
            alterado.
          </DialogDescription>
          <Button onClick={() => setOpened(null)}>Voltar aos projetos</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
const root = createRootRoute({
  component: () => (
    <AuthShell>
      <Outlet />
    </AuthShell>
  ),
});
const agenda = createRoute({ getParentRoute: () => root, path: "/agenda", component: AgendaDemo });
const projects = createRoute({
  getParentRoute: () => root,
  path: "/projetos",
  component: ProjectsDemo,
});
const router = createRouter({
  routeTree: root.addChildren([agenda, projects]),
  history: createMemoryHistory({ initialEntries: ["/agenda"] }),
});
const reactRoot = createRoot(document.getElementById("root")!);
reactRoot.render(
  <QueryClientProvider client={new QueryClient()}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
if (import.meta.hot) {
  import.meta.hot.dispose(() => reactRoot.unmount());
}
