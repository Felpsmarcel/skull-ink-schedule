import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { getArtistPanel } from "@/lib/artist-panel.functions";
import { agendaLinkDay } from "@/lib/agenda-link-date";
import {
  ArtistPanelView,
  ArtistPanelLoading,
  ArtistPanelError,
} from "@/components/artist-panel/artist-panel-view";

const searchSchema = z.object({
  artist: z.string().uuid().optional(),
  days: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(60),
});
const panelQuery = (artist: string | undefined, days: 30 | 60 | 90) =>
  queryOptions({
    queryKey: ["artist-panel", artist, days],
    queryFn: () => getArtistPanel({ data: { artistId: artist, horizon: days } }),
    retry: false,
  });

export const Route = createFileRoute("/_authenticated/painel-tatuador")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ artist: search.artist, days: search.days }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(panelQuery(deps.artist, deps.days)),
  head: () => ({
    meta: [
      { title: "Painel do tatuador · GF Tattoo Studio" },
      {
        name: "description",
        content: "Agenda, projetos e continuidade por tatuador, em leitura administrativa.",
      },
      { property: "og:title", content: "Painel do tatuador · GF Tattoo Studio" },
      {
        property: "og:description",
        content: "Acompanhamento de agendamentos e projetos do GF Tattoo Studio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ArtistPanelPage,
  pendingComponent: ArtistPanelLoading,
  errorComponent: PanelError,
  notFoundComponent: PanelNotFound,
});

function ArtistPanelPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery(panelQuery(search.artist, search.days));
  return (
    <ArtistPanelView
      data={data}
      days={search.days}
      onArtistChange={(artist) => navigate({ search: (prev) => ({ ...prev, artist }) })}
      onDaysChange={(days) => navigate({ search: (prev) => ({ ...prev, days }) })}
      renderLink={(destination, content, className) => {
        if (destination.kind === "home")
          return (
            <Link to="/home" className={className}>
              {content}
            </Link>
          );
        if (destination.kind === "project")
          return (
            <Link
              to="/projetos/$projectId"
              params={{ projectId: destination.projectId }}
              className={className}
            >
              {content}
            </Link>
          );
        return (
          <Link
            to="/agenda"
            search={{
              novo: destination.ghlId ?? undefined,
              date: agendaLinkDay(destination.startAt),
            }}
            className={className}
          >
            {content}
          </Link>
        );
      }}
    />
  );
}

function HomeLink() {
  return (
    <Link
      to="/home"
      className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      Voltar para Hoje
    </Link>
  );
}
function PanelError() {
  const router = useRouter();
  return <ArtistPanelError onRetry={() => router.invalidate()} homeLink={<HomeLink />} />;
}
function PanelNotFound() {
  return <ArtistPanelError homeLink={<HomeLink />} />;
}
