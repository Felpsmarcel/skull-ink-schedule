/* eslint-disable react-refresh/only-export-components -- Standalone isolated review entry. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
  Outlet,
  Link,
} from "@tanstack/react-router";
import { AuthShell } from "../../src/components/layout/auth-shell";
import { HomeView } from "../../src/components/home/home-view";
import { MyDayView, type MyDayData, type MyDayFilter } from "../../src/components/my-day-view";
import { homeActions, type HomeDashboard, type HomeRole } from "../../src/lib/home-dashboard";
import {
  correlateMyDay,
  myDaySummary,
  type DayAppointment,
  type DayCheckin,
} from "../../src/lib/my-day-core";
import "../../src/i18n";
import "./visual.css";

const appointments: DayAppointment[] = [
  {
    id: "demo-1",
    ghlId: "ghl-demo-1",
    name: "Cliente Exemplo 01",
    artist: "Artista Exemplo A",
    start: "2026-11-12T08:00:00Z",
    status: "completed",
  },
  {
    id: "demo-2",
    ghlId: "ghl-demo-2",
    name: "Cliente Exemplo 02",
    artist: "Artista Exemplo B",
    start: "2026-11-12T10:00:00Z",
    status: "confirmed",
  },
  {
    id: "demo-3",
    ghlId: "ghl-demo-3",
    name: "Cliente Exemplo 03",
    artist: "Artista Exemplo A",
    start: "2026-11-12T12:00:00Z",
    status: "confirmed",
  },
  {
    id: "demo-4",
    ghlId: "ghl-demo-4",
    name: "Cliente Exemplo 04 · Nome extenso para revisão de legibilidade",
    artist: null,
    start: "2026-11-12T13:30:00Z",
    status: "pending",
  },
  {
    id: "demo-5",
    ghlId: "ghl-demo-5",
    name: "Cliente Exemplo 05",
    artist: "Artista Exemplo C",
    start: "2026-11-12T14:00:00Z",
    status: "cancelled",
  },
  {
    id: "demo-6",
    ghlId: "ghl-demo-6",
    name: "Cliente Exemplo 06",
    artist: "Artista Exemplo B",
    start: "2026-11-12T14:30:00Z",
    status: "no_show",
  },
  {
    id: "demo-7",
    ghlId: "ghl-demo-7",
    name: "Cliente Exemplo 07",
    artist: "Artista Exemplo C",
    start: "2026-11-12T15:00:00Z",
    status: "confirmed",
  },
];
const checkins: DayCheckin[] = [
  {
    id: "arrival-demo-1",
    appointmentId: "demo-1",
    ghlId: "ghl-demo-1",
    name: "Cliente Exemplo 01",
    status: "concluido",
    arrived: "2026-11-12T07:50:00Z",
    started: "2026-11-12T08:05:00Z",
    finished: "2026-11-12T10:00:00Z",
  },
  {
    id: "arrival-demo-2",
    appointmentId: "demo-2",
    ghlId: "ghl-demo-2",
    name: "Cliente Exemplo 02",
    status: "em_atendimento",
    arrived: "2026-11-12T09:55:00Z",
    started: "2026-11-12T10:10:00Z",
    finished: null,
  },
  {
    id: "arrival-demo-3",
    appointmentId: "demo-3",
    ghlId: "ghl-demo-3",
    name: "Cliente Exemplo 03",
    status: "aguardando",
    arrived: "2026-11-12T11:45:00Z",
    started: null,
    finished: null,
  },
  {
    id: "arrival-demo-5",
    appointmentId: "demo-5",
    ghlId: "ghl-demo-5",
    name: "Cliente Exemplo 05",
    status: "cancelado",
    arrived: "2026-11-12T11:00:00Z",
    started: null,
    finished: null,
  },
  {
    id: "arrival-demo-6",
    appointmentId: "demo-6",
    ghlId: "ghl-demo-6",
    name: "Cliente Exemplo 06",
    status: "nao_compareceu",
    arrived: "2026-11-12T11:30:00Z",
    started: null,
    finished: null,
  },
  {
    id: "arrival-demo-7",
    appointmentId: "demo-7",
    ghlId: "ghl-demo-divergente",
    name: "Cliente Exemplo 07",
    status: "aguardando",
    arrived: "2026-11-12T11:55:00Z",
    started: null,
    finished: null,
  },
];
const updatedAt = "2026-11-12T12:00:00Z";
type Mode =
  | "ready"
  | "empty"
  | "loading"
  | "error"
  | "stale"
  | "partial-arrivals"
  | "partial-agenda";

function dayFixture(mode: Mode): MyDayData | undefined {
  if (mode === "loading" || mode === "error") return undefined;
  const sourceAppointments = mode === "empty" || mode === "partial-agenda" ? [] : appointments;
  const sourceCheckins = mode === "empty" || mode === "partial-arrivals" ? [] : checkins;
  const correlated = correlateMyDay(sourceAppointments, sourceCheckins);
  return {
    ...correlated,
    day: "2026-11-12",
    updatedAt,
    source: "Espelho local · não comprova cobertura integral do GHL",
    coverage: { appointments: mode !== "partial-agenda", checkins: mode !== "partial-arrivals" },
    summary: myDaySummary(
      mode === "partial-agenda" ? null : correlated.rows,
      mode === "partial-arrivals" ? null : sourceCheckins,
    ),
  };
}

function homeFixture(mode: Mode, role: HomeRole): HomeDashboard | undefined {
  if (mode === "loading" || mode === "error") return undefined;
  const empty = mode === "empty";
  return {
    role,
    dateLabel: "quinta-feira, 12 de novembro",
    updatedAtISO: updatedAt,
    actions: homeActions(role),
    next: empty
      ? null
      : {
          ghlAppointmentId: "ghl-demo-3",
          timeLabel: "13:00",
          clientName: "Cliente Exemplo 03",
          artistName: "Artista Exemplo A",
          status: "confirmed",
        },
    fila: empty
      ? { aguardando: 0, emAtendimento: 0, itens: [] }
      : {
          aguardando: 1,
          emAtendimento: 1,
          itens: [
            {
              codigo: "DEMO-03",
              clientName: "Cliente Exemplo 03",
              status: "aguardando",
              timeLabel: "12:45",
              esperaMin: 15,
              artistName: "Artista Exemplo A",
            },
            {
              codigo: "DEMO-02",
              clientName: "Cliente Exemplo 02",
              status: "em_atendimento",
              timeLabel: "10:55",
              esperaMin: 125,
              artistName: "Artista Exemplo B",
            },
          ],
        },
    ...(role === "admin"
      ? {
          gestao: {
            recebidoHoje: empty ? 0 : 1250,
            pendencias: [],
            vinculosHistorico: empty ? 0 : 3,
            vinculosNovos: 0,
            marcoRastreabilidade: "2026-08-29T14:37:33.000Z",
            degraded: false,
            incidentesAbertos: 0,
          },
        }
      : {}),
  };
}

function Demo() {
  const [mode, setMode] = useState<Mode>("ready");
  const [role, setRole] = useState<HomeRole>("admin");
  const [filter, setFilter] = useState<MyDayFilter>("all");
  const [fetching, setFetching] = useState(false);
  const [feedback, setFeedback] = useState("");
  const error = mode === "error" || mode === "stale";
  return (
    <>
      <aside className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <div
          role="note"
          className="rounded-xl border border-primary/20 bg-accent/40 p-4 text-sm leading-6"
        >
          Revisão visual · Clientes, horários, vínculos e valores fictícios. Sem conexão ao GHL ou
          gravação de registros. A seleção de perfil demonstra apenas a apresentação; não valida
          permissões reais.
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex flex-wrap items-center gap-2 text-xs">
              Estado do painel
              <select
                aria-label="Estado do painel"
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value as Mode);
                  setFeedback("");
                }}
                className="min-h-11 max-w-full rounded-lg border bg-card px-3 text-sm"
              >
                <option value="ready">Com atendimentos</option>
                <option value="empty">Sem atendimentos</option>
                <option value="loading">Carregando</option>
                <option value="error">Erro de leitura</option>
                <option value="stale">Falha com leitura anterior</option>
                <option value="partial-arrivals">Chegadas indisponíveis</option>
                <option value="partial-agenda">Agenda indisponível</option>
              </select>
            </label>
            <label className="flex flex-wrap items-center gap-2 text-xs">
              Apresentação do perfil
              <select
                aria-label="Apresentação do perfil"
                value={role}
                onChange={(event) => setRole(event.target.value as HomeRole)}
                className="min-h-11 max-w-full rounded-lg border bg-card px-3 text-sm"
              >
                <option value="admin">Administrador</option>
                <option value="recepcao">Recepção</option>
                <option value="artist">Tatuador</option>
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={fetching}
                onChange={(event) => setFetching(event.target.checked)}
              />
              Atualização em andamento
            </label>
          </div>
          {feedback ? (
            <p role="status" className="mt-2 break-words font-semibold">
              {feedback}
            </p>
          ) : null}
        </div>
      </aside>
      <HomeView
        data={homeFixture(mode, role)}
        isLoading={mode === "loading"}
        isFetching={fetching}
        hasError={error}
        dataUpdatedAt={mode === "loading" || mode === "error" ? 0 : Date.parse(updatedAt)}
        isAdmin={role === "admin"}
        dayOverview={
          role === "admin" ? (
            <MyDayView
              data={dayFixture(mode)}
              filter={filter}
              onFilterChange={setFilter}
              isError={error}
              isPending={mode === "loading"}
              isFetching={fetching}
              onRefresh={() => {
                setMode("ready");
                setFeedback("Actualização demonstrativa. Nenhuma fonte real foi consultada.");
              }}
            />
          ) : undefined
        }
      />
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
const today = createRoute({ getParentRoute: () => root, path: "/home", component: Demo });
const destinations = [
  "/menu",
  "/reconciliar",
  "/relatorios/movimentacoes",
  "/agenda",
  "/projetos",
  "/appointments/new",
  "/financeiro",
  "/totem",
  "/movimentacao",
  "/painel-tatuador",
  "/admin/fila",
  "/admin/saude",
].map((path) =>
  createRoute({
    getParentRoute: () => root,
    path,
    component: () => (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="font-editorial text-3xl">Destino de demonstração</h1>
        <p className="my-4">Atalho verificado: {path}. Nenhum registro real foi aberto.</p>
        <Link
          to="/home"
          className="inline-flex min-h-11 items-center rounded-xl border bg-card px-4"
        >
          Voltar ao dia no estúdio
        </Link>
      </main>
    ),
  }),
);
const router = createRouter({
  routeTree: root.addChildren([today, ...destinations]),
  history: createMemoryHistory({ initialEntries: ["/home"] }),
});
const reactRoot = createRoot(document.getElementById("root")!);
reactRoot.render(
  <QueryClientProvider client={new QueryClient()}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
if (import.meta.hot) import.meta.hot.dispose(() => reactRoot.unmount());
