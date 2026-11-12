import React from "react";
import { createRoot } from "react-dom/client";
import {
  createRouter,
  createRootRoute,
  createRoute,
  createMemoryHistory,
  RouterProvider,
  Outlet,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthShell } from "../../src/components/layout/auth-shell";
import { PageHeader } from "../../src/components/ui/page-header";
import { SectionLabel } from "../../src/components/ui/section-label";
import "../../src/i18n";
import "./visual.css";
const pages = [
  { path: "/home", title: "Hoje no estúdio" },
  { path: "/agenda", title: "Agenda" },
  { path: "/projetos", title: "Projetos do tatuador" },
  { path: "/financeiro", title: "Financeiro" },
  { path: "/menu", title: "Perfil e gestão" },
  { path: "/reconciliar", title: "Reconciliar oportunidades" },
];
export function Screen({ title }: { title: string }) {
  return (
    <>
      <PageHeader
        eyebrow="GF Tattoo Studio"
        title={title}
        description="Revisão de navegação · Conteúdo fictício"
        actions={
          <span className="rounded-full border border-border bg-card px-3 py-2 text-xs">
            Europe/Brussels
          </span>
        }
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-28 sm:px-6">
        <p role="note" className="rounded-xl border border-primary/20 bg-accent/50 p-4 text-sm">
          Prévia visual isolada. Navegação real dos componentes; conteúdo abaixo ilustrativo. Sem
          acesso ao CRM. Sair e criar agendamento não estão disponíveis neste ensaio.
        </p>
        <SectionLabel>Organização do dia</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2">
          {["Orçamentos · Randevu", "Projetos e sessões"].map((label) => (
            <section key={label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-editorial text-2xl">{label}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Área ilustrativa para conferir hierarquia, contraste e espaço de leitura. Nenhum
                atendimento real é exibido.
              </p>
            </section>
          ))}
        </div>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-editorial text-2xl">Continuidade dos projetos</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Validação de rolagem e cabeçalhos fixos.
          </p>
          <div aria-hidden="true" className="h-[70vh]" />
        </section>
      </main>
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
const routes = pages.map((p) =>
  createRoute({
    getParentRoute: () => root,
    path: p.path,
    component: () => <Screen title={p.title} />,
  }),
);
const router = createRouter({
  routeTree: root.addChildren(routes),
  history: createMemoryHistory({ initialEntries: ["/agenda"] }),
});
const client = new QueryClient();
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
