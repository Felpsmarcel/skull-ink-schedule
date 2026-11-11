import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { getProjectDetail, getProjectOpportunities } from "@/lib/projects.functions";
import { ProjectFicha } from "@/components/project-ficha/project-ficha";
import { useAppointmentDraft } from "@/stores/appointment-draft";
import { Button } from "@/components/ui/button";
import { ProjectCommercialSummary } from "@/components/project-commercial-summary";

const searchSchema = z.object({
  status: z.enum(["active", "completed", "cancelled"]).default("active"),
  artist: z.string().uuid().optional(),
  q: z.string().max(100).optional(),
});

const detailQuery = (id: string) =>
  queryOptions({
    queryKey: ["artist-project", id],
    queryFn: () => getProjectDetail({ data: { projectId: id } }),
  });

export const Route = createFileRoute("/_authenticated/projetos/$projectId")({
  validateSearch: zodValidator(searchSchema),
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(detailQuery(params.projectId));
    if (!d) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Projeto · GF Tattoo" },
      { name: "description", content: "Sessões, progresso e saldo do projeto." },
      { property: "og:title", content: "Projeto · GF Tattoo" },
      { property: "og:description", content: "Sessões, progresso e saldo do projeto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProjectPage,
  errorComponent: ProjectError,
  notFoundComponent: () => <p className="p-6 text-sm">Projeto não encontrado ou sem acesso.</p>,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data: p } = useSuspenseQuery(detailQuery(projectId));
  const admin = p?.role === "admin";
  const oppsQ = useQuery({
    queryKey: ["project-opportunities", projectId],
    queryFn: () => getProjectOpportunities({ data: { projectId } }),
    enabled: admin,
    staleTime: 60_000,
    retry: false,
  });
  const [selectedOpp, setSelectedOpp] = useState<string | null>(null);
  if (!p) return null;

  const scheduleNext = () => {
    const d = useAppointmentDraft.getState();
    d.reset();
    if (p.client.ghlContactId) {
      d.setContact({
        id: p.client.ghlContactId,
        contactName: p.client.name ?? undefined,
        phone: p.client.phone ?? undefined,
        email: p.client.email ?? undefined,
      });
    }
    d.setProject({ decision: "reuse", reuseProjectId: p.id, description: p.title });
    navigate({ to: "/appointments/new/agenda" });
  };

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pb-28 pt-4">
      <Link
        to="/projetos"
        search={search}
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Projetos
      </Link>
      <ProjectFicha
        p={p}
        opps={
          !admin
            ? undefined
            : oppsQ.isPending
              ? { kind: "loading" }
              : oppsQ.isError
                ? { kind: "error" }
                : { kind: "ready", data: oppsQ.data }
        }
        selectedOpp={selectedOpp}
        onSelectOpp={setSelectedOpp}
        actions={
          <Button
            className="min-h-11 w-full sm:w-auto"
            onClick={scheduleNext}
            disabled={!p.client.ghlContactId}
          >
            <CalendarPlus className="mr-2 h-4 w-4" /> Agendar próxima sessão
          </Button>
        }
      />
      {admin ? (
        <details className="ficha-panel">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
            Conferência comercial detalhada
          </summary>
          <ProjectCommercialSummary projectId={p.id} />
        </details>
      ) : null}
    </main>
  );
}

function ProjectError() {
  const router = useRouter();
  return (
    <div role="alert" className="space-y-3 p-6 text-sm">
      <p>Projeto indisponível ou sem acesso.</p>
      <Button variant="outline" onClick={() => router.invalidate()}>
        Tentar de novo
      </Button>
    </div>
  );
}
