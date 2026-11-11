import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { getProjectDetail } from "@/lib/projects.functions";
import { formatEurCents } from "@/lib/project-progress-core";
import { useAppointmentDraft } from "@/stores/appointment-draft";
import { Button } from "@/components/ui/button";
import { ProjectContinuity } from "@/components/project-continuity";
import { formatProjectDate, PROJECT_APPOINTMENT_STATUS } from "@/lib/project-journey-core";

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
  if (!p) return null;
  const admin = p.role === "admin";
  const pct = p.progress.total ? Math.round((p.progress.done / p.progress.total) * 100) : 0;

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

      <section className="space-y-2 border-b border-border pb-4">
        <h1 className="font-editorial text-2xl">{p.client.name ?? "Cliente sem nome"}</h1>
        <p className="text-sm">
          {p.title}
          {p.bodyPart ? ` · ${p.bodyPart}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">Tatuador: {p.artistName ?? "Sem tatuador"}</p>
        {admin && (p.client.phone || p.client.email) ? (
          <p className="text-xs text-muted-foreground break-all">
            {[p.client.phone, p.client.email].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {p.description ? (
          <p className="pt-1 text-sm text-muted-foreground">{p.description}</p>
        ) : null}
        <div className="pt-2">
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {p.progress.total} agendamentos vinculados não cancelados · {p.progress.done} conclusões
            registradas
          </p>
        </div>
        <ProjectContinuity nextStartAt={p.progress.nextStartAt} />
        <p className="text-xs text-muted-foreground">
          Tipo de atendimento não verificado. Consulta de orçamento não é automaticamente sessão de
          tatuagem.
        </p>
        <p className="text-xs text-muted-foreground">
          Status comercial não verificado aqui. Datas do espelho local, em Europe/Brussels.
        </p>
        <Button
          className="mt-3 min-h-11 w-full"
          onClick={scheduleNext}
          disabled={!p.client.ghlContactId}
        >
          <CalendarPlus className="mr-2 h-4 w-4" /> Agendar próxima sessão
        </Button>
      </section>

      <section className="border-b border-border pb-4">
        <h2 className="mb-2 text-base font-semibold">Histórico de agendamentos</h2>
        {p.sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum agendamento vinculado disponível. Continuidade a verificar.
          </p>
        ) : (
          <ol className="space-y-2">
            {p.sessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-border py-2 pl-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">Agendamento vinculado</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {formatProjectDate(s.startAt)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {PROJECT_APPOINTMENT_STATUS[s.status] ?? "Status não verificado"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="pb-4">
        <h2 className="mb-2 text-sm font-semibold">Financeiro</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {admin ? (
            <>
              <Money label="Valor integral" v={p.finance.quotedCents} />
              <Money label="Sinal" v={p.finance.depositCents} />
              <Money label="Recebido" v={p.finance.receivedCents} />
              <Money label="Saldo" v={p.finance.balanceCents} strong />
            </>
          ) : null}
          <Money
            label="Parte do tatuador (35% do recebido)"
            v={p.finance.artistShareCents}
            strong={!admin}
          />
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          "A apurar" indica valor ainda não confirmado — não é zero.
        </p>
      </section>
    </main>
  );
}

function Money({ label, v, strong }: { label: string; v: number | null; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold text-primary" : ""}`}>
        {formatEurCents(v)}
      </dd>
    </div>
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
