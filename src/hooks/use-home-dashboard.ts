import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getHomeDashboard } from "@/lib/home.functions";
import type { HomeDashboard } from "@/lib/home-dashboard";

/** Painel da Home: uma única chamada, refetch leve de 60 s. */
export function useHomeDashboard() {
  const fetchDashboard = useServerFn(getHomeDashboard);
  return useQuery<HomeDashboard>({
    queryKey: ["home-dashboard"],
    queryFn: () => fetchDashboard(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
}
