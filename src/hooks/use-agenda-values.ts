import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAgendaValues } from "@/lib/agenda-values.functions";
import type { AgendaValuesSource } from "@/lib/agenda-values-core";

export function useAgendaValues(
  startMs: number,
  endExclusiveMs: number,
  identity: { userId: string; role: string | null } | undefined,
  enabled: boolean,
) {
  const fetchValues = useServerFn(getAgendaValues);
  const allowed = enabled && identity?.role === "admin" && Boolean(identity.userId);
  const query = useQuery({
    queryKey: ["agenda-values", identity?.userId, identity?.role, startMs, endExclusiveMs],
    enabled: allowed,
    queryFn: () =>
      fetchValues({
        data: {
          startISO: new Date(startMs).toISOString(),
          endISO: new Date(endExclusiveMs).toISOString(),
        },
      }),
    staleTime: 60_000,
    retry: false,
  });
  const source: AgendaValuesSource =
    allowed && !query.isError && query.data
      ? query.data
      : {
          state: "unavailable",
          items: [],
          reason: allowed
            ? "Leitura dos valores indisponível"
            : "Valores restritos à administração",
        };
  return {
    source,
    isFetching: allowed && query.isFetching,
    refetch: () => (allowed ? query.refetch() : Promise.resolve()),
  };
}
