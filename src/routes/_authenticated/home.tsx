import { createFileRoute } from "@tanstack/react-router";
import { useHomeDashboard } from "@/hooks/use-home-dashboard";
import { useCurrentUser } from "@/hooks/use-current-user";
import { MyDay } from "@/components/my-day";
import { HomeView } from "@/components/home/home-view";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Central operacional — GF Tattoo Studio" },
      {
        name: "description",
        content: "Próximo cliente, fila do dia e ações rápidas do GF Tattoo Studio.",
      },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Meu Dia — GF Tattoo Studio" },
      {
        property: "og:description",
        content: "Agenda e acompanhamento dos atendimentos do GF Tattoo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: me } = useCurrentUser();
  const { data, isLoading, isFetching, error, dataUpdatedAt } = useHomeDashboard();
  const isAdmin = me?.role === "admin";
  return (
    <HomeView
      data={data}
      isLoading={isLoading}
      isFetching={isFetching}
      hasError={Boolean(error)}
      dataUpdatedAt={dataUpdatedAt}
      isAdmin={isAdmin}
      dayOverview={isAdmin ? <MyDay /> : undefined}
    />
  );
}
