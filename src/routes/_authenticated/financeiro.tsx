import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useFinanceSummary } from "@/hooks/use-finance";
import { useIsAdmin } from "@/hooks/use-current-user";
import { SyncGhlButton } from "@/components/sync-ghl-button";
import {
  FinanceView,
  type FinanceViewModel,
  type FinancePeriod as Period,
  type FinanceBucketFilter as BucketFilter,
} from "@/components/finance/finance-view";
import { filterFinanceRows } from "@/lib/finance-list-filters";

const financeSearchSchema = z.object({
  period: fallback(z.string(), "all").default("all"),
  bucket: fallback(z.string(), "all").default("all"),
  artist: fallback(z.string(), "all").default("all"),
  seller: fallback(z.string(), "all").default("all"),
});

export const Route = createFileRoute("/_authenticated/financeiro")({
  validateSearch: zodValidator(financeSearchSchema),
  head: () => ({
    meta: [
      { title: "Financeiro — GF Tattoo Studio" },
      { name: "description", content: "Painel financeiro do GF Tattoo Studio." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: FinanceiroPage,
});

const ALLOWED_PERIODS: Period[] = ["today", "week", "month", "all"];
const ALLOWED_BUCKETS: BucketFilter[] = ["all", "pago", "pendente", "a_receber"];

function FinanceiroPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useFinanceSummary();
  const isAdmin = useIsAdmin();

  const search = Route.useSearch();
  const period: Period = (ALLOWED_PERIODS as string[]).includes(search.period)
    ? (search.period as Period)
    : "all";
  const bucket: BucketFilter = (ALLOWED_BUCKETS as string[]).includes(search.bucket)
    ? (search.bucket as BucketFilter)
    : "all";
  const artistId = search.artist || "all";
  const sellerId = search.seller || "all";

  const setSearch = (
    patch: Partial<{ period: string; bucket: string; artist: string; seller: string }>,
  ) => {
    navigate({
      to: "/financeiro",
      search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }),
      replace: true,
    });
  };
  const model: FinanceViewModel | null = !data
    ? null
    : data.role === "admin"
      ? {
          role: "admin",
          data,
          rows: filterFinanceRows(data.rows, period, bucket, artistId, sellerId),
        }
      : data.role === "artist"
        ? { role: "artist", data, rows: filterFinanceRows(data.rows, period, bucket, "all", "all") }
        : {
            role: "seller",
            data,
            rows: filterFinanceRows(data.rows, period, bucket, "all", "all"),
          };

  return (
    <FinanceView
      model={model}
      filters={{ period, bucket, artist: artistId, seller: sellerId }}
      isLoading={isLoading}
      error={error ? (error as Error).message : null}
      onRetry={() => void refetch()}
      onBack={() => navigate({ to: "/agenda" })}
      onFiltersChange={setSearch}
      actions={
        isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <SyncGhlButton />
            <Link
              to="/reconciliar"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-medium hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Reconciliar
            </Link>
          </div>
        ) : undefined
      }
    />
  );
}
