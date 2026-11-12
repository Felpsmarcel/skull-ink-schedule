/* eslint-disable react-refresh/only-export-components -- Isolated synthetic visual review entry. */
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
  useRouterState,
} from "@tanstack/react-router";
import { AuthShell } from "../../src/components/layout/auth-shell";
import { FinanceWorkspace } from "../../src/components/finance/finance-workspace";
import type {
  FinanceWorkspaceData,
  FinanceSession,
  WorkspaceFilters,
} from "../../src/lib/finance-workspace-types";
import "../../src/i18n";
import "./visual.css";

type Mode = "ready" | "empty" | "error" | "loading" | "partial";
type Role = FinanceWorkspaceData["role"];
const now = new Date("2026-11-12T12:00:00Z");
const artists = [
  { id: "demo-artist-a", name: "Artista Exemplo A" },
  { id: "demo-artist-b", name: "Artista Exemplo B" },
];
const defaultFilters: WorkspaceFilters = {
  area: "projects",
  period: "month",
  from: "2026-11-01",
  to: "2026-11-30",
  artist: "all",
};
const sessions: FinanceSession[] = [
  {
    id: "demo-session-a1",
    client: "Cliente Exemplo 01 · Cobertura das costas",
    artistId: artists[0].id,
    artist: artists[0].name,
    date: "2026-11-12T09:00:00Z",
    status: "confirmed",
    projectId: "demo-project-a",
    amountCents: 50000,
    commissionCents: 17500,
    commissionPct: 35,
    excluded: false,
  },
  {
    id: "demo-session-a2",
    client: "Cliente Exemplo 01 · Cobertura das costas",
    artistId: artists[0].id,
    artist: artists[0].name,
    date: "2026-11-20T09:00:00Z",
    status: "pending",
    projectId: "demo-project-a",
    amountCents: 50000,
    commissionCents: 17500,
    commissionPct: 35,
    excluded: false,
  },
  {
    id: "demo-session-a3",
    client: "Cliente Exemplo 01 · Cobertura das costas",
    artistId: artists[0].id,
    artist: artists[0].name,
    date: "2026-12-01T09:00:00Z",
    status: "confirmed",
    projectId: "demo-project-a",
    amountCents: 50000,
    commissionCents: 20000,
    commissionPct: 40,
    excluded: false,
  },
  {
    id: "demo-session-b1",
    client: "Cliente Exemplo 02 · Projeto floral",
    artistId: artists[1].id,
    artist: artists[1].name,
    date: "2026-11-12T13:00:00Z",
    status: "completed",
    projectId: "demo-project-b",
    amountCents: 60000,
    commissionCents: 24000,
    commissionPct: 40,
    excluded: false,
  },
  {
    id: "demo-session-b-randevu",
    client: "Cliente Exemplo 03 · Randevu fictício",
    artistId: artists[1].id,
    artist: artists[1].name,
    date: "2026-11-12T15:00:00Z",
    status: "confirmed",
    projectId: null,
    amountCents: 0,
    commissionCents: 0,
    commissionPct: 40,
    excluded: true,
  },
  {
    id: "demo-session-b-cancelled",
    client: "Cliente Exemplo 04 · Cancelamento fictício",
    artistId: artists[1].id,
    artist: artists[1].name,
    date: "2026-11-12T16:00:00Z",
    status: "cancelled",
    projectId: null,
    amountCents: 30000,
    commissionCents: 12000,
    commissionPct: 40,
    excluded: true,
  },
];

function fixture(
  role: Role,
  mode: Mode,
  missingValue: boolean,
  area: WorkspaceFilters["area"],
): FinanceWorkspaceData | undefined {
  if (mode === "loading" || mode === "error") return undefined;
  const empty = mode === "empty";
  const admin = role === "admin";
  const data: FinanceWorkspaceData = {
    role,
    updatedAt: now.toISOString(),
    artists: admin ? artists : role === "artist" ? [artists[0]] : [],
    projects: {
      state: admin ? "complete" : "unavailable",
      rows:
        !admin || empty
          ? []
          : [
              {
                id: "demo-project-a",
                title: "Cobertura das costas · Projeto fictício de 3 sessões",
                client: "Cliente Exemplo 01",
                artistId: artists[0].id,
                artist: artists[0].name,
                date: "2026-11-12T08:00:00Z",
                status: "scheduled",
                quotedCents: 150000,
                opportunityId: "demo-opportunity-a",
              },
              {
                id: "demo-project-b",
                title: "Floral · Projeto fictício independente",
                client: "Cliente Exemplo 02",
                artistId: artists[1].id,
                artist: artists[1].name,
                date: "2026-11-12T10:00:00Z",
                status: "quoted",
                quotedCents: missingValue ? null : 60000,
                opportunityId: null,
              },
            ],
    },
    receipts: {
      state: admin ? "complete" : "unavailable",
      rows:
        !admin || empty
          ? []
          : [
              {
                id: "demo-receipt-deposit",
                client: "Cliente Exemplo 01 · Sinal do projeto",
                artistId: artists[0].id,
                artist: artists[0].name,
                date: "2026-11-12",
                kind: "sinal",
                amountCents: 20000,
                projectId: "demo-project-a",
                appointmentId: "demo-session-a1",
                methods: ["Cartão"],
                sync: "synced",
              },
              {
                id: "demo-receipt-refund",
                client: "Cliente Exemplo 01 · Estorno parcial",
                artistId: artists[0].id,
                artist: artists[0].name,
                date: "2026-11-12",
                kind: "estorno",
                amountCents: 5000,
                projectId: "demo-project-a",
                appointmentId: "demo-session-a1",
                methods: ["Cartão"],
                sync: "pending",
              },
              {
                id: "demo-receipt-b",
                client: "Cliente Exemplo 02 · Recebimento fictício",
                artistId: artists[1].id,
                artist: artists[1].name,
                date: "2026-11-12",
                kind: "sessao",
                amountCents: missingValue ? null : 30000,
                projectId: null,
                appointmentId: "demo-session-b1",
                methods: ["Transferência"],
                sync: "failed",
              },
            ],
    },
    sessions: {
      state: "complete",
      rows: empty
        ? []
        : sessions
            .filter((session) => role !== "artist" || session.artistId === artists[0].id)
            .filter(
              (session) =>
                role !== "seller" || ["demo-session-a1", "demo-session-b1"].includes(session.id),
            )
            .map((session) => {
              const unknown =
                missingValue &&
                session.id === (role === "artist" ? "demo-session-a1" : "demo-session-b1");
              if (admin)
                return {
                  ...session,
                  amountCents: unknown ? null : session.amountCents,
                  commissionCents: unknown ? null : session.commissionCents,
                };
              // Mirror the non-admin allowlist: no gross amount, project link or other artist labels.
              return {
                id: session.id,
                client: session.client,
                artistId: session.artistId,
                artist: role === "artist" ? artists[0].name : null,
                date: session.date,
                status: session.status,
                projectId: null,
                commissionCents: unknown
                  ? null
                  : role === "seller"
                    ? session.id === "demo-session-a1"
                      ? 2500
                      : 3000
                    : session.commissionCents,
                commissionPct: role === "seller" ? 5 : session.commissionPct,
                excluded: session.excluded,
              };
            }),
    },
  };
  if (mode === "partial") {
    const selectedSource = admin ? area : "sessions";
    if (selectedSource !== "payouts") data[selectedSource] = { state: "unavailable", rows: [] };
  }
  return data;
}

function Demo() {
  const [role, setRole] = useState<Role>("admin");
  const [mode, setMode] = useState<Mode>("ready");
  const [filters, setFilters] = useState(defaultFilters);
  const [missingValue, setMissingValue] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [stale, setStale] = useState(false);
  const [feedback, setFeedback] = useState("");
  return (
    <>
      <aside className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
        <div
          role="note"
          className="rounded-xl border border-primary/20 bg-accent/40 p-4 text-sm leading-6"
        >
          <strong>DEMONSTRAÇÃO — DADOS FICTÍCIOS.</strong> Sem conexão ao GHL, consulta ao banco ou
          gravação. Data de referência: 12/11/2026, Bruxelas. Os perfis demonstram apresentação e
          não validam permissões reais. A navegação externa usa o perfil administrativo fixo do
          ambiente de revisão.
          <p className="mt-2 text-xs text-muted-foreground">
            Projeto A: 1.500 € em 3 sessões de 500 € (12/11, 20/11 e 01/12). Sinal informado: 200 €;
            estorno: 50 €. Projeto B, artista B: orçamento independente de 600 €. Esses valores não
            se somam como um único faturamento. Percentuais e comissões são exemplos armazenados,
            sem apuração real.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex flex-wrap items-center gap-2 text-xs">
              Apresentação do perfil
              <select
                aria-label="Apresentação do perfil"
                value={role}
                onChange={(event) => {
                  const nextRole = event.target.value as Role;
                  setRole(nextRole);
                  setFilters((current) => ({
                    ...current,
                    artist: "all",
                    area: nextRole === "admin" ? "projects" : "sessions",
                  }));
                  setFeedback("");
                }}
                className="min-h-11 max-w-full rounded-lg border bg-card px-3 text-sm"
              >
                <option value="admin">Administrador</option>
                <option value="artist">Tatuador · Artista Exemplo A</option>
                <option value="seller">Vendedor · Exemplo 5%</option>
              </select>
            </label>
            <label className="flex flex-wrap items-center gap-2 text-xs">
              Estado da leitura
              <select
                aria-label="Estado da leitura"
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value as Mode);
                  setFeedback("");
                }}
                className="min-h-11 max-w-full rounded-lg border bg-card px-3 text-sm"
              >
                <option value="ready">Com registros</option>
                <option value="empty">Sem registros</option>
                <option value="error">Erro sem leitura anterior</option>
                <option value="loading">Carregando</option>
                <option value="partial">Fonte da visão indisponível</option>
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={missingValue}
                onChange={(event) => setMissingValue(event.target.checked)}
              />
              Valor ausente em um registro
            </label>
            <label className="flex min-h-11 items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={fetching}
                onChange={(event) => setFetching(event.target.checked)}
              />
              Atualização em andamento
            </label>
            <label className="flex min-h-11 items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={stale}
                onChange={(event) => setStale(event.target.checked)}
              />
              Falha com leitura anterior
            </label>
          </div>
          {feedback ? (
            <p role="status" className="mt-2 font-semibold">
              {feedback}
            </p>
          ) : null}
        </div>
      </aside>
      <FinanceWorkspace
        data={fixture(role, mode, missingValue, filters.area)}
        filters={filters}
        loading={mode === "loading"}
        fetching={fetching}
        error={mode === "error" || stale}
        onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
        onRefresh={() => {
          setMode("ready");
          setStale(false);
          setFeedback("Leitura simulada atualizada. Nenhuma fonte real foi consultada.");
        }}
        now={now}
      />
    </>
  );
}

function Destination() {
  const location = useRouterState({ select: (state) => state.location });
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="font-editorial text-3xl">Destino de demonstração</h1>
      <p className="my-4 break-all">
        Atalho verificado: {location.pathname}. Nenhum registro real foi aberto.
      </p>
      <Link
        to="/financeiro"
        className="inline-flex min-h-11 items-center rounded-xl border bg-card px-4"
      >
        Voltar ao financeiro
      </Link>
    </main>
  );
}
const root = createRootRoute({
  component: () => (
    <AuthShell>
      <Outlet />
    </AuthShell>
  ),
});
const finance = createRoute({ getParentRoute: () => root, path: "/financeiro", component: Demo });
const destinations = [
  "/home",
  "/menu",
  "/agenda",
  "/projetos",
  "/appointments/new",
  "/reconciliar",
  "/relatorios/movimentacoes",
  "/projetos/$projectId",
  "/auth",
].map((path) => createRoute({ getParentRoute: () => root, path, component: Destination }));
const router = createRouter({
  routeTree: root.addChildren([finance, ...destinations]),
  history: createMemoryHistory({ initialEntries: ["/financeiro"] }),
});
const reactRoot = createRoot(document.getElementById("root")!);
reactRoot.render(
  <QueryClientProvider client={new QueryClient()}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
if (import.meta.hot) import.meta.hot.dispose(() => reactRoot.unmount());
