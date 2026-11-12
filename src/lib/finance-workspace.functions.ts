import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RANDEVU_CALENDAR_ID } from "@/lib/artist-commission-policy";
import { localDateSchema } from "@/lib/dashboard-period";
import { moneyCents, validateFinanceSource } from "@/lib/finance-workspace-core";
import { readMyDayPages } from "@/lib/my-day-read";
import type {
  FinanceProject,
  FinanceReceipt,
  FinanceSession,
  FinanceSource,
  FinanceWorkspaceData,
} from "@/lib/finance-workspace-types";

/** A short page alone cannot prove completeness when a server applies a lower row cap. */
async function readFinancePages<T extends { id: string }>(
  fetchPage: (
    from: number,
    to: number,
  ) => Promise<{
    data: T[] | null;
    error: unknown;
    count: number | null;
  }>,
): Promise<T[]> {
  let expectedCount: number | null = null;
  const rows = await readMyDayPages(async (from, to) => {
    const result = await fetchPage(from, to);
    if (
      !Number.isSafeInteger(result.count) ||
      result.count === null ||
      result.count < 0 ||
      (expectedCount !== null && result.count !== expectedCount)
    )
      throw new Error("Cobertura não verificada");
    expectedCount = result.count;
    return result;
  });
  if (rows.length !== expectedCount) throw new Error("Cobertura incompleta");
  return validateFinanceSource(rows);
}

function requiredId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
    throw new Error("Identificação incompleta");
  }
}

function validateDate(value: string, civil = false): string {
  if (
    typeof value !== "string" ||
    !localDateSchema.safeParse(civil ? value : value.slice(0, 10)).success ||
    (!civil &&
      (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
        !Number.isFinite(Date.parse(value))))
  )
    throw new Error("Data não verificada");
  return value;
}

function percentage(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)))
    return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
}

function excludedSession(status: string, calendarId: string | null): boolean {
  return (
    status === "cancelled" ||
    status === "canceled" ||
    status === "no_show" ||
    calendarId === RANDEVU_CALENDAR_ID
  );
}

function unavailable<T>(): FinanceSource<T> {
  return { state: "unavailable", rows: [] };
}

function sourceResult<T>(result: PromiseSettledResult<T[]>): FinanceSource<T> {
  return result.status === "fulfilled"
    ? { state: "complete", rows: result.value }
    : unavailable<T>();
}

/** Independent local read: no CRM fetch, payment mutation, privileged client or payout inference. */
export const getFinanceWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FinanceWorkspaceData> => {
    const { supabase, userId } = context;
    const { data: me, error: profileError } = await supabase
      .from("app_users")
      .select("role,artist_id,seller_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError || !me || !["admin", "artist", "seller"].includes(me.role)) {
      throw new Response("Acesso não autorizado", { status: 403 });
    }

    if (me.role === "artist" || me.role === "seller") {
      const linkedId = me.role === "artist" ? me.artist_id : me.seller_id;
      if (!linkedId?.trim()) throw new Response("Perfil sem vínculo", { status: 403 });
      const { data: linked, error: linkError } = await supabase
        .from(me.role === "artist" ? "artists" : "sellers")
        .select("id,name,active")
        .eq("id", linkedId)
        .maybeSingle();
      if (linkError || !linked || linked.id !== linkedId || linked.active !== true) {
        throw new Response("Vínculo não verificado", { status: 403 });
      }

      const ownSessions = async (): Promise<FinanceSession[]> => {
        // Seller RPC also exposes gross amounts. Select and project a strict allowlist instead.
        const rows =
          me.role === "artist"
            ? await readFinancePages(
                async (from, to) =>
                  await supabase
                    .rpc("get_my_artist_appointments", undefined, { count: "exact" })
                    .select(
                      "id,artist_id,calendar_id,contact_name,start_at,status,commission_eur,commission_pct",
                    )
                    .eq("artist_id", linkedId)
                    .order("id")
                    .range(from, to),
              )
            : await readFinancePages(
                async (from, to) =>
                  await supabase
                    .rpc("get_my_seller_appointments", undefined, { count: "exact" })
                    .select(
                      "id,artist_id,seller_id,calendar_id,contact_name,start_at,status,commission_eur,commission_pct",
                    )
                    .eq("seller_id", linkedId)
                    .order("id")
                    .range(from, to),
              );
        return rows.map((row): FinanceSession => {
          requiredId(row.artist_id);
          if (
            me.role === "artist"
              ? row.artist_id !== linkedId
              : !("seller_id" in row) || row.seller_id !== linkedId
          ) {
            throw new Error("Escopo divergente");
          }
          requiredId(row.status);
          const pct = percentage(row.commission_pct);
          return {
            id: row.id,
            client: row.contact_name,
            artistId: row.artist_id,
            artist: me.role === "artist" ? linked.name : null,
            date: validateDate(row.start_at),
            status: row.status,
            projectId: null,
            // Artist RPC uses the appointment snapshot; seller RPC uses its current seller rate.
            commissionCents: pct === null ? null : moneyCents(row.commission_eur),
            commissionPct: pct,
            excluded: excludedSession(row.status, row.calendar_id),
          };
        });
      };
      const [sessions] = await Promise.allSettled([ownSessions()]);
      return {
        role: me.role,
        updatedAt: new Date().toISOString(),
        artists: me.role === "artist" ? [{ id: linked.id, name: linked.name }] : [],
        projects: unavailable<FinanceProject>(),
        receipts: unavailable<FinanceReceipt>(),
        sessions: sourceResult(sessions),
      };
    }

    // Explicit admin branch: an unexpected role can never fall through into broad reads.
    if (me.role !== "admin") throw new Response("Acesso não autorizado", { status: 403 });
    const projectsRead = async (): Promise<FinanceProject[]> => {
      const rows = await readFinancePages(
        async (from, to) =>
          await supabase
            .from("tattoo_projects")
            .select(
              "id,title,artist_id,created_at,status,quoted_total_eur,ghl_opportunity_id,contacts(name),artists(name)",
              { count: "exact" },
            )
            .order("id")
            .range(from, to),
      );
      return rows.map((row) => {
        requiredId(row.status);
        if (row.artist_id !== null) requiredId(row.artist_id);
        const quoted = moneyCents(row.quoted_total_eur);
        return {
          id: row.id,
          title: row.title || "Projeto sem título",
          client: row.contacts?.name ?? null,
          artistId: row.artist_id,
          artist: row.artists?.name ?? null,
          date: validateDate(row.created_at),
          status: row.status,
          // Zero is the database registration default, not proof of a free/confirmed quote.
          quotedCents: quoted !== null && quoted > 0 ? quoted : null,
          opportunityId: row.ghl_opportunity_id,
        };
      });
    };
    const receiptsRead = async (): Promise<FinanceReceipt[]> => {
      const rows = await readFinancePages(
        async (from, to) =>
          await supabase
            .from("movimentacoes")
            .select(
              "id,nome_cliente,artist_id,data_pagamento,tipo_movimento,total,valor_cartao,valor_dinheiro,valor_sumup,valor_transferencia,project_id,appointment_id,ghl_sync_status,artists(name)",
              { count: "exact" },
            )
            .is("deleted_at", null)
            .order("id")
            .range(from, to),
      );
      return rows.map((row) => {
        requiredId(row.artist_id);
        requiredId(row.tipo_movimento);
        const methods = [
          { label: "Cartão", amount: moneyCents(row.valor_cartao) },
          { label: "Dinheiro", amount: moneyCents(row.valor_dinheiro) },
          { label: "SumUp", amount: moneyCents(row.valor_sumup) },
          { label: "Transferência", amount: moneyCents(row.valor_transferencia) },
        ];
        const total = moneyCents(row.total);
        const sum = methods.reduce((acc, method) => acc + (method.amount ?? 0), 0);
        const validAmount =
          total !== null &&
          total > 0 &&
          methods.every((method) => method.amount !== null) &&
          Number.isSafeInteger(sum) &&
          sum === total;
        return {
          id: row.id,
          client: row.nome_cliente,
          artistId: row.artist_id,
          artist: row.artists?.name ?? null,
          date: validateDate(row.data_pagamento, true),
          kind: row.tipo_movimento,
          amountCents: validAmount ? total : null,
          projectId: row.project_id,
          appointmentId: row.appointment_id,
          methods: methods
            .filter((method) => method.amount !== null && method.amount > 0)
            .map((method) => method.label),
          sync: row.ghl_sync_status,
        };
      });
    };
    const sessionsRead = async (): Promise<FinanceSession[]> => {
      const rows = await readFinancePages(
        async (from, to) =>
          await supabase
            .from("appointments")
            .select(
              "id,artist_id,calendar_id,contact_name,start_at,status,project_id,total_eur,commission_pct,artists(name),seller_id,sellers(name,commission_pct)",
              { count: "exact" },
            )
            .order("id")
            .range(from, to),
      );
      return rows.map((row) => {
        requiredId(row.artist_id);
        requiredId(row.status);
        const amount = moneyCents(row.total_eur);
        const pct = percentage(row.commission_pct);
        const commission =
          amount === null || pct === null ? null : Math.round((amount * pct) / 100);
        if (row.seller_id !== null) requiredId(row.seller_id);
        const sellerPct = percentage(row.sellers?.commission_pct);
        // The legacy seller relationship contains its current rate, not a historical snapshot.
        const sellerCommission =
          row.seller_id === null
            ? 0
            : amount === null || sellerPct === null
              ? null
              : Math.round((amount * sellerPct) / 100);
        return {
          id: row.id,
          client: row.contact_name,
          artistId: row.artist_id,
          artist: row.artists?.name ?? null,
          date: validateDate(row.start_at),
          status: row.status,
          projectId: row.project_id,
          amountCents: amount,
          commissionCents:
            commission !== null && Number.isSafeInteger(commission) ? commission : null,
          commissionPct: pct,
          sellerId: row.seller_id,
          seller: row.sellers?.name ?? null,
          sellerCommissionCents:
            sellerCommission !== null && Number.isSafeInteger(sellerCommission)
              ? sellerCommission
              : null,
          excluded: excludedSession(row.status, row.calendar_id),
        };
      });
    };
    const artistsRead = () =>
      readFinancePages(
        async (from, to) =>
          await supabase
            .from("artists")
            .select("id,name", { count: "exact" })
            .order("id")
            .range(from, to),
      );
    const [projects, receipts, sessions, artists] = await Promise.allSettled([
      projectsRead(),
      receiptsRead(),
      sessionsRead(),
      artistsRead(),
    ]);
    return {
      role: "admin",
      updatedAt: new Date().toISOString(),
      artists: artists.status === "fulfilled" ? artists.value : [],
      projects: sourceResult(projects),
      receipts: sourceResult(receipts),
      sessions: sourceResult(sessions),
    };
  });
