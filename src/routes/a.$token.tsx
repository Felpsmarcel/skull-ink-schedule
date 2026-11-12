import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PublicCheckinView } from "@/components/checkin/totem-views";
import { getCheckinByToken } from "@/lib/checkin.functions";

export const Route = createFileRoute("/a/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "O seu atendimento — GF Tattoo Studio" },
      { name: "description", content: "Acompanhe o estado do seu atendimento no GF Tattoo." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AtendimentoPublico,
});

function AtendimentoPublico() {
  const { token } = Route.useParams();
  const fetchCheckin = useServerFn(getCheckinByToken);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["checkin-publico", token],
    queryFn: () => fetchCheckin({ data: { token } }),
    refetchInterval: 30_000,
  });

  return (
    <PublicCheckinView
      data={data}
      loading={isLoading}
      error={Boolean(error)}
      onRetry={() => void refetch()}
    />
  );
}
