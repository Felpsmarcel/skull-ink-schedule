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
import { HealthView } from "../../src/components/health/health-view";
import type { OperationalHealth } from "../../src/lib/observability";
import "../../src/i18n";
import "./visual.css";

const fixture: OperationalHealth = {
  level: "critico",
  generatedAtISO: "2026-11-12T15:30:00Z",
  degraded: false,
  metrics: {
    openCount: 2,
    criticalCount: 1,
    syncFailures: 4,
    reconciliationRequired: 1,
    movimentacoesFailed: 2,
    checkinsFailed: 1,
  },
  incidents: [
    {
      id: "incident-fixture-1",
      fingerprint: "fixture-ghl-auth",
      source: "ghl",
      kind: "sync_authorization_failure",
      severity: "critica",
      status: "open",
      message:
        "Exemplo fictício · GHL 401 unauthorized. A consulta de sincronização não foi concluída.",
      safeContext: {
        httpStatus: 401,
        attempts: 3,
        step: "appointment-sync",
        operationId: "operacao-ficticia-para-revisao-visual-sem-conexao-a-registros-reais",
      },
      occurrences: 3,
      firstSeenAt: "2026-11-12T08:20:00Z",
      lastSeenAt: "2026-11-12T15:25:00Z",
      acknowledgedAt: null,
    },
    {
      id: "incident-fixture-2",
      fingerprint: "fixture-payment-timeout",
      source: "pagamento",
      kind: "payment_sync_timeout",
      severity: "alta",
      status: "acknowledged",
      message: "Exemplo fictício · Timeout ao consultar o estado de sincronização do lançamento.",
      safeContext: {
        durationMs: 30000,
        status: "pending",
        route: "/movimentacao/formulario-ficticio",
      },
      occurrences: 2,
      firstSeenAt: "2026-11-12T09:10:00Z",
      lastSeenAt: "2026-11-12T10:40:00Z",
      acknowledgedAt: "2026-11-12T11:00:00Z",
    },
    {
      id: "incident-fixture-3",
      fingerprint: "fixture-email-network",
      source: "email",
      kind: "email_delivery_network_failure",
      severity: "media",
      status: "open",
      message: "Exemplo fictício · Falha de rede ao consultar a entrega da confirmação.",
      safeContext: {},
      occurrences: 1,
      firstSeenAt: "2026-11-12T12:30:00Z",
      lastSeenAt: "2026-11-12T12:30:00Z",
      acknowledgedAt: null,
    },
  ],
};
type Mode = "ready" | "empty" | "loading" | "error" | "degraded";
function Demo() {
  const [mode, setMode] = useState<Mode>("ready");
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [feedback, setFeedback] = useState("");
  const data: OperationalHealth =
    mode === "empty" || mode === "degraded"
      ? {
          ...fixture,
          level: "ok",
          degraded: mode === "degraded",
          incidents: [],
          metrics: {
            openCount: 0,
            criticalCount: 0,
            syncFailures: 0,
            reconciliationRequired: 0,
            movimentacoesFailed: 0,
            checkinsFailed: 0,
          },
        }
      : fixture;
  return (
    <>
      <aside className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <div
          role="note"
          className="rounded-xl border border-primary/20 bg-accent/40 p-4 text-sm leading-6"
        >
          Revisão visual · Incidentes, métricas e horários fictícios. Sem conexão ao GHL ou gravação
          de registros.
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
                <option value="ready">Com incidentes</option>
                <option value="empty">Sem incidentes</option>
                <option value="loading">Carregando</option>
                <option value="error">Erro de leitura</option>
                <option value="degraded">Leitura parcial</option>
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={busy}
                onChange={(event) => setBusy(event.target.checked)}
              />
              Ação em andamento
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
      <HealthView
        data={data}
        isLoading={mode === "loading"}
        isFetching={fetching}
        isError={mode === "error"}
        error={
          mode === "error"
            ? new Error("Erro fictício de leitura. Nenhum serviço real foi consultado.")
            : undefined
        }
        busy={busy}
        onRefresh={() => {
          setMode("ready");
          setFeedback("Atualização demonstrativa. Nenhuma fonte real foi consultada.");
        }}
        onAcknowledge={(id) =>
          setFeedback(`Reconhecimento demonstrativo de ${id}. Nenhum incidente real foi alterado.`)
        }
        onResolve={(id) =>
          setFeedback(`Resolução demonstrativa de ${id}. Nenhum incidente real foi alterado.`)
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
const health = createRoute({ getParentRoute: () => root, path: "/admin/saude", component: Demo });
const destinations = [
  "/menu",
  "/reconciliar",
  "/relatorios/movimentacoes",
  "/home",
  "/agenda",
  "/projetos",
  "/appointments/new",
  "/financeiro",
].map((path) =>
  createRoute({
    getParentRoute: () => root,
    path,
    component: () => (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="font-editorial text-3xl">Destino de demonstração</h1>
        <p className="my-4">Atalho verificado: {path}. Nenhum registro real foi aberto.</p>
        <Link
          to="/admin/saude"
          className="inline-flex min-h-11 items-center rounded-xl border bg-card px-4"
        >
          Voltar à saúde do sistema
        </Link>
      </main>
    ),
  }),
);
const router = createRouter({
  routeTree: root.addChildren([health, ...destinations]),
  history: createMemoryHistory({ initialEntries: ["/admin/saude"] }),
});
const reactRoot = createRoot(document.getElementById("root")!);
reactRoot.render(
  <QueryClientProvider client={new QueryClient()}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
if (import.meta.hot) import.meta.hot.dispose(() => reactRoot.unmount());
