import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFinanceSummary, type FinanceSummary } from "@/lib/finance.functions";

export function useFinanceSummary() {
  const fetcher = useServerFn(getFinanceSummary);
  return useQuery<FinanceSummary>({
    queryKey: ["finance-summary"],
    queryFn: () => fetcher(),
    staleTime: 5 * 60_000,
  });
}