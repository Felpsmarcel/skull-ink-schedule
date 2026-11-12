/* eslint-disable react-refresh/only-export-components -- Standalone visual harness with an HMR-disposed root. */
import { useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
  Outlet,
  Link,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthShell } from "../../src/components/layout/auth-shell";
import { Button } from "../../src/components/ui/button";
import {
  FinanceView,
  type FinanceFilters,
  type FinanceViewModel,
} from "../../src/components/finance/finance-view";
import {
  ArtistPanelView,
  ArtistPanelLoading,
  ArtistPanelError,
  type ArtistPanelData,
  type ArtistPanelDays,
} from "../../src/components/artist-panel/artist-panel-view";
import { filterFinanceRows } from "../../src/lib/finance-list-filters";
import { agendaLinkDay } from "../../src/lib/agenda-link-date";
import type {
  AdminSummary,
  AdminAppointmentRow,
  ArtistAppointmentRow,
} from "../../src/lib/finance.functions";
import "../../src/i18n";
import "./visual.css";

const artists = [
  { id: "example-a", name: "Artista Exemplo A" },
  { id: "example-b", name: "Artista Exemplo B" },
];
const base = {
  status: "confirmed",
  manualOverride: false,
  sellerId: null,
  sellerName: null,
  sellerCommissionEur: 0,
};
const financeRows: AdminAppointmentRow[] = [
  {
    ...base,
    id: "demo-1",
    startAt: "2026-11-12T09:00:00Z",
    endAt: "2026-11-12T12:00:00Z",
    contactName: "Cliente Exemplo 1",
    servicesSummary: "Cobertura · primeira etapa fictícia",
    artistId: "example-a",
    artistName: "Artista Exemplo A",
    totalEur: 1000,
    commissionEur: 350,
    studioEur: 650,
    bucket: "pago",
    sellerId: "seller-example",
    sellerName: "Vendedor Exemplo",
    sellerCommissionEur: 50,
  },
  {
    ...base,
    id: "demo-2",
    startAt: "2026-11-09T09:00:00Z",
    endAt: "2026-11-09T12:00:00Z",
    contactName: "Cliente Exemplo 2",
    servicesSummary: "Projeto fictício · segunda etapa",
    artistId: "example-b",
    artistName: "Artista Exemplo B",
    totalEur: 600,
    commissionEur: 210,
    studioEur: 390,
    bucket: "pendente",
    manualOverride: true,
  },
  {
    ...base,
    id: "demo-3",
    startAt: "2026-12-15T09:00:00Z",
    endAt: "2026-12-15T12:00:00Z",
    contactName: "Cliente Exemplo 1",
    servicesSummary: "Cobertura · terceira etapa fictícia",
    artistId: "example-a",
    artistName: "Artista Exemplo A",
    totalEur: 1200,
    commissionEur: 480,
    studioEur: 720,
    bucket: "a_receber",
  },
];
const adminSummary: AdminSummary = {
  role: "admin",
  rows: financeRows,
  artists,
  sellers: [{ id: "seller-example", name: "Vendedor Exemplo" }],
  totalBruto: 2800,
  comissaoTotal: 1040,
  estudioTotal: 1760,
  pago: 1000,
  pendente: 600,
  aReceber: 1200,
  vendedorComissaoTotal: 50,
};
const defaultFilters: FinanceFilters = {
  period: "all",
  bucket: "all",
  artist: "all",
  seller: "all",
};
const fixedNow = new Date("2026-11-12T12:00:00Z");
type DemoState = "ready" | "empty" | "loading" | "error" | "unavailable";
function PreviewControls({ children }: { children: ReactNode }) {
  return (
    <aside className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
      <div
        role="note"
        className="rounded-xl border border-primary/20 bg-accent/50 p-4 text-sm leading-6"
      >
        Prévia de revisão · Clientes, horários e valores fictícios. Componentes reais com dados de
        exemplo, sem conexão ao GHL ou alteração de registros.
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            className="inline-flex min-h-11 items-center rounded-lg border bg-card px-3 font-semibold"
            to="/financeiro"
          >
            Financeiro
          </Link>
          <Link
            className="inline-flex min-h-11 items-center rounded-lg border bg-card px-3 font-semibold"
            to="/painel-tatuador"
          >
            Painel do tatuador
          </Link>
          {children}
        </div>
      </div>
    </aside>
  );
}
function StatePicker({
  value,
  onChange,
}: {
  value: DemoState;
  onChange: (value: DemoState) => void;
}) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-xs">
      Estado de teste
      <select
        aria-label="Estado de teste"
        value={value}
        onChange={(event) => onChange(event.target.value as DemoState)}
        className="min-h-11 max-w-full rounded-lg border bg-background px-3 text-sm"
      >
        <option value="ready">Com dados</option>
        <option value="empty">Vazio</option>
        <option value="loading">Carregando</option>
        <option value="error">Erro</option>
        <option value="unavailable">Fonte indisponível</option>
      </select>
    </label>
  );
}
function FinanceDemo() {
  const [role, setRole] = useState<"admin" | "artist" | "seller">("admin");
  const [state, setState] = useState<DemoState>("ready");
  const [filters, setFilters] = useState<FinanceFilters>(defaultFilters);
  const [missingNames, setMissingNames] = useState(false);
  const rows =
    state === "empty"
      ? []
      : financeRows.map((row) =>
          missingNames && row.id === "demo-1" ? { ...row, artistName: "", sellerName: null } : row,
        );
  let model: FinanceViewModel | null = null;
  if (state !== "unavailable") {
    if (role === "admin") {
      const data: AdminSummary =
        state === "empty"
          ? {
              ...adminSummary,
              rows,
              totalBruto: 0,
              comissaoTotal: 0,
              estudioTotal: 0,
              pago: 0,
              pendente: 0,
              aReceber: 0,
              vendedorComissaoTotal: 0,
            }
          : { ...adminSummary, rows };
      model = {
        role,
        data,
        rows: filterFinanceRows(
          rows,
          filters.period,
          filters.bucket,
          filters.artist,
          filters.seller,
          fixedNow,
        ),
      };
    } else {
      const privateRows: ArtistAppointmentRow[] = rows
        .filter((row) =>
          role === "artist" ? row.artistId === "example-a" : row.sellerId === "seller-example",
        )
        .map((row) => ({
          id: row.id,
          startAt: row.startAt,
          endAt: row.endAt,
          status: row.status,
          contactName: row.contactName,
          servicesSummary: row.servicesSummary,
          commissionEur: role === "artist" ? row.commissionEur : row.sellerCommissionEur,
          bucket: row.bucket,
          manualOverride: row.manualOverride,
        }));
      const totals = { aReceber: 0, pendente: 0, pago: 0 };
      for (const row of privateRows)
        totals[row.bucket === "a_receber" ? "aReceber" : row.bucket] += row.commissionEur;
      const filtered = filterFinanceRows(
        privateRows,
        filters.period,
        filters.bucket,
        "all",
        "all",
        fixedNow,
      );
      model =
        role === "artist"
          ? { role, data: { role, rows: privateRows, ...totals }, rows: filtered }
          : { role, data: { role, rows: privateRows, ...totals }, rows: filtered };
    }
  }
  return (
    <>
      <PreviewControls>
        <label className="flex items-center gap-2 text-xs">
          Visão
          <select
            aria-label="Visão de teste"
            className="min-h-11 rounded-lg border bg-background px-3 text-sm"
            value={role}
            onChange={(event) => {
              setRole(event.target.value as typeof role);
              setFilters(defaultFilters);
            }}
          >
            <option value="admin">Administração</option>
            <option value="artist">Tatuador</option>
            <option value="seller">Vendedor</option>
          </select>
        </label>
        <StatePicker value={state} onChange={setState} />
        <label className="flex min-h-11 items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={missingNames}
            onChange={(event) => setMissingNames(event.target.checked)}
          />
          Testar nomes indisponíveis
        </label>
      </PreviewControls>
      <FinanceView
        model={model}
        filters={filters}
        isLoading={state === "loading"}
        error={
          state === "error"
            ? "Erro fictício de leitura — nenhum serviço externo foi consultado."
            : null
        }
        onRetry={() => setState("ready")}
        onBack={() => window.location.assign("/operations.html")}
        onFiltersChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
      />
    </>
  );
}
function PanelDemo() {
  const [artistId, setArtistId] = useState(artists[0].id);
  const [days, setDays] = useState<ArtistPanelDays>(60);
  const [state, setState] = useState<DemoState>("ready");
  const [destination, setDestination] = useState("");
  const allDates = [
    {
      id: "demo-appointment-today",
      projectId: "demo-project-a",
      name: "Cliente Exemplo 1",
      startAt: "2026-11-12T09:00:00Z",
      endAt: "2026-11-12T12:00:00Z",
      status: "confirmed",
      ghlId: "example-ghl-today",
    },
    {
      id: "demo-appointment-future",
      projectId: "demo-project-a",
      name: "Cliente Exemplo 1",
      startAt: "2026-12-15T09:00:00Z",
      endAt: "2026-12-15T12:00:00Z",
      status: "pending",
      ghlId: "example-ghl-future",
    },
  ];
  const empty = state === "empty" || artistId === "example-b";
  const missing = state === "unavailable";
  const dates = empty ? [] : allDates;
  const data: ArtistPanelData = {
    artist: artists.find((artist) => artist.id === artistId)!,
    artists,
    bounds: {
      day: "2026-11-12",
      start: "2026-11-11T23:00:00Z",
      tomorrow: "2026-11-12T23:00:00Z",
      end: new Date(fixedNow.getTime() + days * 86400000).toISOString(),
    },
    horizon: days,
    updatedAt: "2026-11-12T12:00:00Z",
    today: missing ? null : dates.slice(0, 1),
    upcoming: missing ? null : days === 30 ? [] : dates.slice(1),
    projects: missing
      ? null
      : empty
        ? []
        : [
            {
              id: "demo-project-a",
              title: "Cobertura das costas · projeto fictício",
              status: "in_progress",
              continuity: { linked: 2, done: 0, future: 1, next: "2026-12-15T09:00:00Z" },
              dates,
            },
            {
              id: "demo-project-b",
              title: "Reforma do braço · projeto fictício",
              status: "quoted",
              continuity: { linked: 0, done: 0, future: 0, next: null },
              dates: [],
            },
          ],
  };
  return (
    <>
      <PreviewControls>
        <StatePicker value={state} onChange={setState} />
      </PreviewControls>
      {destination ? (
        <p role="status" className="mx-auto max-w-6xl break-words px-4 py-3 text-sm">
          {destination}
        </p>
      ) : null}
      {state === "loading" ? (
        <ArtistPanelLoading />
      ) : state === "error" ? (
        <ArtistPanelError
          onRetry={() => setState("ready")}
          homeLink={<Button onClick={() => setState("ready")}>Voltar à prévia</Button>}
        />
      ) : (
        <ArtistPanelView
          data={data}
          days={days}
          onArtistChange={setArtistId}
          onDaysChange={setDays}
          renderLink={(target, content, className) => (
            <button
              type="button"
              className={`${className} w-full text-left`}
              onClick={() =>
                setDestination(
                  target.kind === "appointment"
                    ? `Destino demonstrativo: agenda de ${agendaLinkDay(target.startAt)} · ${target.ghlId ?? "sem ID GHL"}. Nenhum registro foi aberto.`
                    : target.kind === "project"
                      ? `Destino demonstrativo: projeto ${target.projectId}. Nenhum registro foi aberto.`
                      : "Retorno demonstrativo ao dia do estúdio.",
                )
              }
            >
              {content}
            </button>
          )}
        />
      )}
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
const finance = createRoute({
  getParentRoute: () => root,
  path: "/financeiro",
  component: FinanceDemo,
});
const panel = createRoute({
  getParentRoute: () => root,
  path: "/painel-tatuador",
  component: PanelDemo,
});
const router = createRouter({
  routeTree: root.addChildren([finance, panel]),
  history: createMemoryHistory({ initialEntries: ["/financeiro"] }),
});
const reactRoot = createRoot(document.getElementById("root")!);
reactRoot.render(
  <QueryClientProvider client={new QueryClient()}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
if (import.meta.hot) import.meta.hot.dispose(() => reactRoot.unmount());
