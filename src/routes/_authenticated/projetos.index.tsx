import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { listArtistProjects } from "@/lib/projects.functions";
import { formatEurCents } from "@/lib/project-progress-core";
import { useArtists } from "@/hooks/use-artists";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  status: z.enum(["active", "completed", "cancelled"]).default("active"),
  artist: z.string().uuid().optional(),
  q: z.string().max(100).optional(),
});

const listQuery = (s: z.infer<typeof searchSchema>) =>
  queryOptions({
    queryKey: ["artist-projects", s.status, s.artist ?? null, s.q ?? ""],
    queryFn: () =>
      listArtistProjects({ data: { status: s.status, artistId: s.artist ?? null, q: s.q ?? null, page: 0 } }),
  });

export const Route = createFileRoute("/_authenticated/projetos/")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ status: search.status ?? "active", artist: search.artist, q: search.q }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(listQuery(deps)),
  head: () => ({
    meta: [
      { title: "Projetos do Tatuador · GF Tattoo" },
      { name: "description", content: "Projetos multi-sessões com progresso e saldo." },
      { property: "og:title", content: "Projetos do Tatuador · GF Tattoo" },
      { property: "og:description", content: "Projetos multi-sessões com progresso e saldo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectsPage,
  errorComponent: ProjectsError,
  notFoundComponent: () => <p className="p-6 text-sm">Nenhum projeto encontrado.</p>,
});

function ProjectsError({ error }: { error: unknown }) {
  const router = useRouter();
  return (
    <div role="alert" className="space-y-3 p-6 text-sm">
      <p>{error instanceof Error ? error.message : String(error)}</p>
      <Button variant="outline" onClick={() => router.invalidate()}>Tentar de novo</Button>
    </div>
  );
}

const STATUS_LABEL = { active: "Em andamento", completed: "Concluídos", cancelled: "Cancelados" } as const;
const dateFmt = new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Brussels", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function ProjectsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data } = useSuspenseQuery(listQuery(search));
  const { data: artists } = useArtists();
  const isAdmin = data.role === "admin";
  const list = (artists ?? []).filter((a) => !/augusto|miguel|^gf( tattoo)?$/i.test(a.name ?? ""));
  const unassigned = isAdmin ? data.items.filter((i) => !i.artistId) : [];
  const assigned = data.items.filter((i) => i.artistId || !isAdmin);

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pb-28 pt-4">
      <header>
        <h1 className="font-editorial text-2xl">Projetos do Tatuador</h1>
        <p className="text-sm text-muted-foreground">Sessões, progresso e saldo de cada projeto.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={search.status === k ? "default" : "outline"}
            className="min-h-11"
            onClick={() => navigate({ search: (p) => ({ ...p, status: k }) })}
          >
            {STATUS_LABEL[k]}
          </Button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          defaultValue={search.q ?? ""}
          placeholder="Buscar cliente ou projeto"
          aria-label="Buscar cliente ou projeto"
          className="min-h-11"
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate({ search: (p) => ({ ...p, q: e.currentTarget.value || undefined }) });
          }}
        />
        {isAdmin ? (
          <select
            aria-label="Tatuador"
            className="min-h-11 rounded-md border border-input bg-background px-3 text-sm"
            value={search.artist ?? ""}
            onChange={(e) => navigate({ search: (p) => ({ ...p, artist: e.target.value || undefined }) })}
          >
            <option value="">Todos os tatuadores</option>
            {list.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        ) : null}
      </div>

      {unassigned.length ? (
        <section className="space-y-2 rounded-md border border-warning/50 bg-warning/10 p-3">
          <h2 className="text-sm font-semibold text-warning">Sem tatuador — resolver</h2>
          {unassigned.map((p) => <ProjectCard key={p.id} p={p} admin search={search} />)}
        </section>
      ) : null}

      {assigned.length === 0 && unassigned.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum projeto aqui ainda. Projetos aparecem quando uma marcação com várias sessões é criada.
        </p>
      ) : (
        <ul className="space-y-2">
          {assigned.map((p) => (
            <li key={p.id}><ProjectCard p={p} admin={isAdmin} search={search} /></li>
          ))}
        </ul>
      )}
      {data.hasMore ? <p className="text-xs text-muted-foreground">Mostrando os 30 mais recentes; refine a busca.</p> : null}
    </main>
  );
}

type Item = Awaited<ReturnType<typeof listArtistProjects>>["items"][number];

function ProjectCard({ p, admin, search }: { p: Item; admin: boolean; search: z.infer<typeof searchSchema> }) {
  const pct = p.sessionsTotal ? Math.round((p.sessionsDone / p.sessionsTotal) * 100) : 0;
  return (
    <Link
      to="/projetos/$projectId"
      params={{ projectId: p.id }}
      search={search}
      className="block rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{p.clientName ?? "Cliente sem nome"}</p>
          <p className="truncate text-sm text-muted-foreground">{p.title}</p>
          {admin ? <p className="text-xs text-muted-foreground">{p.artistName ?? "Sem tatuador"}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">{admin ? "Saldo" : "Sua parte (35%)"}</p>
          <p className="font-semibold tabular-nums text-primary">
            {formatEurCents(admin ? p.balanceCents : p.artistShareCents)}
          </p>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{p.sessionsDone} de {p.sessionsTotal} sessões realizadas</span>
        <span>{p.nextStartAt ? `Próxima: ${dateFmt.format(new Date(p.nextStartAt))}` : "Sem próxima data"}</span>
      </div>
    </Link>
  );
}
