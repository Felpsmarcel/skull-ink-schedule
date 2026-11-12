import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { listArtistProjects } from "@/lib/projects.functions";
import { useArtists } from "@/hooks/use-artists";
import { Button } from "@/components/ui/button";
import { ProjectsView } from "@/components/projects/projects-view";

const searchSchema = z.object({
  status: z.enum(["active", "completed", "cancelled"]).default("active"),
  artist: z.string().uuid().optional(),
  q: z.string().max(100).optional(),
});

const listQuery = (s: z.infer<typeof searchSchema>) =>
  queryOptions({
    queryKey: ["artist-projects", s.status, s.artist ?? null, s.q ?? ""],
    queryFn: () =>
      listArtistProjects({
        data: { status: s.status, artistId: s.artist ?? null, q: s.q ?? null, page: 0 },
      }),
  });

export const Route = createFileRoute("/_authenticated/projetos/")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({
    status: search.status ?? "active",
    artist: search.artist,
    q: search.q,
  }),
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

function ProjectsError() {
  const router = useRouter();
  return (
    <div role="alert" className="space-y-3 p-6 text-sm">
      <p>Projetos indisponíveis ou sem acesso.</p>
      <Button variant="outline" onClick={() => router.invalidate()}>
        Tentar de novo
      </Button>
    </div>
  );
}

function ProjectsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data } = useSuspenseQuery(listQuery(search));
  const { data: artists } = useArtists();
  const list = (artists ?? []).filter((a) => !/augusto|miguel|^gf\b/i.test(a.name ?? ""));

  return (
    <ProjectsView
      role={data.role}
      items={data.items}
      artists={list}
      search={search}
      hasMore={data.hasMore}
      onSearchChange={(next) => navigate({ search: next })}
      renderProjectLink={(project, content, className) => (
        <Link
          to="/projetos/$projectId"
          params={{ projectId: project.id }}
          search={search}
          className={className}
        >
          {content}
        </Link>
      )}
    />
  );
}
