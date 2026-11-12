/* eslint-disable react-refresh/only-export-components -- Standalone isolated review entry. */
import { useState } from "react";
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
import { AccountView } from "../../src/components/account/account-view";
import {
  PaymentLinkCardView,
  type PaymentLinkCardState,
} from "../../src/components/movimentacao/payment-link-card-view";
import { getAccountMenu } from "../../src/lib/account-menu";
import type { MyProfile } from "../../src/lib/auth.functions";
import "../../src/i18n";
import "./visual.css";

type Mode = "admin" | "artist" | "seller" | "unlinked" | "unknown" | "loading" | "error";
const identity: MyProfile = {
  userId: "demo-user",
  email: "conta.exemplo@example.test",
  role: "admin",
  artistId: null,
  sellerId: null,
};
function Demo() {
  const [mode, setMode] = useState<Mode>("admin");
  const [receiptState, setReceiptState] = useState<PaymentLinkCardState["kind"]>("ready");
  const [feedback, setFeedback] = useState("");
  const profile: MyProfile =
    mode === "artist"
      ? { ...identity, role: "artist", artistId: "demo-artist" }
      : mode === "seller"
        ? { ...identity, role: "seller", sellerId: "demo-seller" }
        : mode === "unlinked"
          ? { ...identity, role: "artist" }
          : mode === "unknown"
            ? { ...identity, role: null }
            : identity;
  const state: PaymentLinkCardState =
    receiptState === "ready"
      ? {
          kind: "ready",
          displayName: "Pessoa Exemplo",
          address: {
            url: "http://127.0.0.1:8784/account.html?formulario=demonstracao",
            isTest: true,
          },
        }
      : { kind: receiptState };
  return (
    <>
      <aside className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <div
          role="note"
          className="rounded-xl border border-primary/20 bg-accent/40 p-4 text-sm leading-6"
        >
          Revisão visual · Identidades fictícias. Sem conexão ao GHL ou gravação de registros. O
          cabeçalho usa uma conta administrativa de demonstração; o seletor altera somente o
          conteúdo da tela.
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex flex-wrap items-center gap-2 text-xs">
              Perfil de teste
              <select
                aria-label="Perfil de teste"
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as Mode);
                  setFeedback("");
                }}
                className="min-h-11 max-w-full rounded-lg border bg-card px-3 text-sm"
              >
                {[
                  ["admin", "Administrador"],
                  ["artist", "Tatuador"],
                  ["seller", "Vendedor"],
                  ["unlinked", "Sem vínculo"],
                  ["unknown", "Sem perfil"],
                  ["loading", "Carregando"],
                  ["error", "Erro de acesso"],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-wrap items-center gap-2 text-xs">
              Link de registro
              <select
                aria-label="Estado do link"
                value={receiptState}
                onChange={(e) => setReceiptState(e.target.value as PaymentLinkCardState["kind"])}
                className="min-h-11 max-w-full rounded-lg border bg-card px-3 text-sm"
              >
                {[
                  ["ready", "Disponível"],
                  ["no_link", "Sem link"],
                  ["loading", "Carregando"],
                  ["error", "Erro"],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {feedback ? (
            <p role="status" className="mt-2 font-semibold">
              {feedback}
            </p>
          ) : null}
        </div>
      </aside>
      <AccountView
        profile={profile}
        isLoading={mode === "loading"}
        error={mode === "error"}
        onRetry={() => setMode("admin")}
        onSignOut={() => setFeedback("Demonstração: nenhuma sessão foi encerrada.")}
        receiptLink={
          <PaymentLinkCardView
            state={state}
            onCopy={() => setFeedback("Demonstração: cópia simulada, sem link real.")}
            onRetry={() => setReceiptState("ready")}
          />
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
const menu = createRoute({ getParentRoute: () => root, path: "/menu", component: Demo });
const destinations = Array.from(
  new Set([
    "/home",
    "/agenda",
    "/projetos",
    "/appointments/new",
    ...[
      identity,
      { ...identity, role: "artist" as const, artistId: "demo" },
      { ...identity, role: "seller" as const, sellerId: "demo" },
    ].flatMap((profile) =>
      getAccountMenu(profile).flatMap((section) => section.items.map((item) => item.to)),
    ),
  ]),
);
const routes = destinations.map((path) =>
  createRoute({
    getParentRoute: () => root,
    path,
    component: () => (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="font-editorial text-3xl">Destino de demonstração</h1>
        <p className="my-4">Atalho verificado: {path}. Este ensaio não executa a função real.</p>
        <Link
          to="/menu"
          className="inline-flex min-h-11 items-center rounded-xl border bg-card px-4"
        >
          Voltar à conta
        </Link>
      </main>
    ),
  }),
);
const router = createRouter({
  routeTree: root.addChildren([menu, ...routes]),
  history: createMemoryHistory({ initialEntries: ["/menu"] }),
});
const client = new QueryClient();
const reactRoot = createRoot(document.getElementById("root")!);
reactRoot.render(
  <QueryClientProvider client={client}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
if (import.meta.hot) import.meta.hot.dispose(() => reactRoot.unmount());
