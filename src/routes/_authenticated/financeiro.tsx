import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getFinanceWorkspace } from "@/lib/finance-workspace.functions";
import { FinanceWorkspace } from "@/components/finance/finance-workspace";
import type { WorkspaceFilters } from "@/lib/finance-workspace-types";

const financeSearchSchema = z.object({
  area: fallback(z.enum(["projects", "receipts", "sessions", "payouts"]), "receipts").default(
    "receipts",
  ),
  period: fallback(z.enum(["today", "week", "month", "all", "custom"]), "month").default("month"),
  from: fallback(z.string().max(10), "").default(""),
  to: fallback(z.string().max(10), "").default(""),
  artist: fallback(z.string().max(100), "all").default("all"),
});
export const Route = createFileRoute("/_authenticated/financeiro")({
  validateSearch: zodValidator(financeSearchSchema),
  head: () => ({
    meta: [
      { title: "Financeiro — GF Tattoo Studio" },
      {
        name: "description",
        content: "Projetos, recebimentos, sessões e repasses da GF Tattoo Studio.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: FinanceiroPage,
});
function FinanceiroPage() {
  const navigate = useNavigate();
  const identity = useCurrentUser();
  const me = identity.data;
  const allowed =
    me?.role === "admin" ||
    (me?.role === "artist" && !!me.artistId) ||
    (me?.role === "seller" && !!me.sellerId);
  const fetcher = useServerFn(getFinanceWorkspace);
  const query = useQuery({
    queryKey: ["finance-workspace", me?.userId, me?.role, me?.artistId, me?.sellerId],
    queryFn: () => fetcher(),
    enabled: !!allowed,
    staleTime: 60_000,
    retry: false,
  });
  // The router adapter erases this schema's inferred shape; runtime parsing remains mandatory.
  const filters = financeSearchSchema.parse(Route.useSearch()) as WorkspaceFilters;
  const onChange = (patch: Partial<WorkspaceFilters>) => {
    void navigate({ to: "/financeiro", search: (prev) => ({ ...prev, ...patch }), replace: true });
  };
  return (
    <FinanceWorkspace
      data={allowed && query.data?.role === me?.role ? query.data : undefined}
      filters={filters}
      loading={identity.isPending || (!!allowed && query.isPending)}
      fetching={query.isFetching}
      error={identity.isError || query.isError || (!identity.isPending && !allowed)}
      onChange={onChange}
      onRefresh={() => {
        if (allowed) void query.refetch();
        else void identity.refetch();
      }}
    />
  );
}
