import type { SupabaseClient } from "@supabase/supabase-js";
import { DashboardError, type DashboardScope } from "./dashboard-scope";
import { dashboardPeriod } from "./dashboard-period";
import { fetchCrmAppointments, fetchCrmFinance, summarizeCrmFinance } from "./mcp/crm";
import { fetchStudioPaymentsForClient } from "./mcp/payments";

/** No artist gross, studio share or guessed commissions. */
export async function readDashboard(
  client: SupabaseClient,
  scope: DashboardScope,
  from: string,
  to: string,
  signal?: AbortSignal,
) {
  if (scope.role !== "admin" && scope.role !== "artist")
    throw new DashboardError(403, "Papel não autorizado");
  if (
    scope.role === "artist" &&
    (!scope.artistId ||
      !scope.restrictToGhlUserId ||
      scope.artists.length !== 1 ||
      scope.artists[0]?.id !== scope.artistId)
  )
    throw new DashboardError(403, "Vínculo não verificado");
  const period = dashboardPeriod(from, to);
  const calendars = scope.artists.flatMap((a) =>
    a.ghl_calendar_id ? [{ calendarId: a.ghl_calendar_id, artistName: a.name }] : [],
  );
  const bounded = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(25_000)])
    : AbortSignal.timeout(25_000);
  const [agenda, finance, payments] = await Promise.allSettled([
    calendars.length
      ? fetchCrmAppointments(calendars, from, to, bounded)
      : Promise.reject(new Error("No calendar")),
    fetchCrmFinance(from, to, scope.artistsByUserId, scope.restrictToGhlUserId, bounded),
    scope.role === "admin"
      ? fetchStudioPaymentsForClient(
          client,
          from,
          to,
          new Map(scope.artists.map((a) => [a.id, a.name])),
          null,
          bounded,
        )
      : Promise.resolve(null),
  ]);
  const a = agenda.status === "fulfilled" ? agenda.value : null;
  const f = finance.status === "fulfilled" ? finance.value : null;
  const p = payments.status === "fulfilled" ? payments.value : null;
  const partial =
    !a ||
    a.partial ||
    a.truncated ||
    !f ||
    f.truncated ||
    (scope.role === "admin" && (!p || p.truncado));
  const financeSummary = f ? summarizeCrmFinance(f.rows, from, to, f.truncated) : null;
  return {
    fetchedAt: new Date().toISOString(),
    period,
    source: { appointments: "crm", opportunities: "crm", confirmedPayments: "app_movimentacoes" },
    paymentMeaning:
      "Lançamentos registados no estúdio; não são transações bancárias verificadas nem pagamentos confirmados pelo CRM.",
    partial,
    appointments: {
      complete: !!a && !a.partial && !a.truncated,
      truncated: a?.truncated ?? true,
      count: a && !a.partial && !a.truncated ? a.rows.length : null,
      items: (a?.rows ?? []).slice(0, 200).map((r) => ({
        id: r.crm_event_id,
        startAt: r.start_at,
        endAt: r.end_at,
        status: r.status,
      })),
      itemsTruncated: (a?.rows.length ?? 0) > 200,
    },
    opportunities:
      scope.role === "admin"
        ? {
            complete: !!f && !f.truncated,
            truncated: f?.truncated ?? true,
            summary: financeSummary,
          }
        : {
            complete: !!f && !f.truncated,
            truncated: f?.truncated ?? true,
            count: f && !f.truncated ? f.rows.length : null,
            byStatus:
              f && !f.truncated
                ? Object.entries(
                    f.rows.reduce<Record<string, number>>((acc, r) => {
                      acc[r.status] = (acc[r.status] ?? 0) + 1;
                      return acc;
                    }, {}),
                  ).map(([status, count]) => ({ status, count }))
                : [],
            financialEligibility: "not_proven",
            commissionOmitted: true,
          },
    confirmedPayments:
      scope.role === "admin" ? p : { financialEligibility: "not_proven", commissionOmitted: true },
  };
}
