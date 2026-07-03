import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PaymentBucket = "pago" | "pendente" | "a_receber";

export interface ArtistAppointmentRow {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  contactName: string | null;
  servicesSummary: string | null;
  commissionEur: number;
  bucket: PaymentBucket;
  manualOverride: boolean;
}

export interface AdminAppointmentRow extends ArtistAppointmentRow {
  totalEur: number;
  studioEur: number;
  artistId: string;
  sellerId: string | null;
  sellerName: string | null;
  sellerCommissionEur: number;
}

export interface ArtistSummary {
  role: "artist";
  aReceber: number;
  pendente: number;
  pago: number;
  rows: ArtistAppointmentRow[];
}

export interface AdminSummary {
  role: "admin";
  totalBruto: number;
  comissaoTotal: number;
  estudioTotal: number;
  pago: number;
  pendente: number;
  aReceber: number;
  vendedorComissaoTotal: number;
  rows: AdminAppointmentRow[];
}

export type FinanceSummary = ArtistSummary | AdminSummary;

export function deriveBucket(
  startAt: string,
  hasPayment: boolean,
  manualOverride?: string | null,
): PaymentBucket {
  const override = parseManualBucket(manualOverride);
  if (override) return override;
  if (hasPayment) return "pago";
  const start = new Date(startAt).getTime();
  if (start < Date.now()) return "pendente";
  return "a_receber";
}

export function parseManualBucket(
  value: string | null | undefined,
): PaymentBucket | null {
  if (value === "pago" || value === "pendente" || value === "a_receber") {
    return value;
  }
  return null;
}

export const getFinanceSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FinanceSummary> => {
    const { supabase, userId } = context;

    const { data: meRow, error: meErr } = await supabase
      .from("app_users" as never)
      .select("role, artist_id")
      .eq("id", userId)
      .maybeSingle();
    if (meErr) throw new Error(meErr.message);
    const me = meRow as { role: "admin" | "artist"; artist_id: string | null } | null;
    if (!me) throw new Error("Sem perfil");

    // Fetch payments map (only paid ones matter for bucket).
    const { data: payRows, error: payErr } = await supabase
      .from("payments" as never)
      .select("appointment_id, status")
      .eq("status", "paid");
    if (payErr) throw new Error(payErr.message);
    const paidIds = new Set(
      ((payRows ?? []) as Array<{ appointment_id: string | null }>)
        .map((r) => r.appointment_id)
        .filter((x): x is string => Boolean(x)),
    );

    if (me.role === "artist") {
      const { data, error } = await supabase.rpc(
        "get_my_artist_appointments" as never,
      );
      if (error) throw new Error(error.message);
      const rpcRows = (
        (data ?? []) as Array<{
          id: string;
          start_at: string;
          end_at: string;
          status: string;
          contact_name: string | null;
          services_summary: string | null;
          commission_eur: number | string;
        }>
      ).sort((a, b) => (a.start_at < b.start_at ? 1 : -1));

      const overrideMap = await fetchOverrideMap(
        supabase,
        rpcRows.map((r) => r.id),
      );

      const rows: ArtistAppointmentRow[] = rpcRows
        .map((r) => {
        const commission = Number(r.commission_eur);
        const manualRaw = overrideMap.get(r.id) ?? null;
        return {
          id: r.id,
          startAt: r.start_at,
          endAt: r.end_at,
          status: r.status,
          contactName: r.contact_name,
          servicesSummary: r.services_summary,
          commissionEur: commission,
          bucket: deriveBucket(r.start_at, paidIds.has(r.id), manualRaw),
          manualOverride: parseManualBucket(manualRaw) !== null,
        };
      });

      let aReceber = 0;
      let pendente = 0;
      let pago = 0;
      for (const r of rows) {
        if (r.bucket === "pago") pago += r.commissionEur;
        else if (r.bucket === "pendente") pendente += r.commissionEur;
        else aReceber += r.commissionEur;
      }

      return {
        role: "artist",
        aReceber: round2(aReceber),
        pendente: round2(pendente),
        pago: round2(pago),
        rows,
      };
    }

    // Admin
    const { data, error } = await supabase
      .from("appointments" as never)
      .select(
        "id,artist_id,start_at,end_at,status,contact_name,total_eur,commission_pct,services,manual_payment_status,seller_id",
      )
      .order("start_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rawRows = (
      (data ?? []) as Array<{
        id: string;
        artist_id: string;
        start_at: string;
        end_at: string;
        status: string;
        contact_name: string | null;
        total_eur: number | string;
        commission_pct: number | string;
        services: Array<{ name?: string }>;
        manual_payment_status: string | null;
        seller_id: string | null;
      }>
    );

    // Fetch sellers referenced
    const sellerIds = Array.from(
      new Set(rawRows.map((r) => r.seller_id).filter((x): x is string => !!x)),
    );
    const sellersMap = new Map<string, { name: string; pct: number }>();
    if (sellerIds.length > 0) {
      const { data: sellerRows } = await (supabase as any)
        .from("sellers" as never)
        .select("id, name, commission_pct")
        .in("id", sellerIds);
      for (const s of ((sellerRows ?? []) as Array<{
        id: string;
        name: string;
        commission_pct: number | string;
      }>)) {
        sellersMap.set(s.id, { name: s.name, pct: Number(s.commission_pct) });
      }
    }

    const rows: AdminAppointmentRow[] = rawRows.map((r) => {
      const total = Number(r.total_eur);
      const pct = Number(r.commission_pct);
      const commission = round2((total * pct) / 100);
      const studio = round2(total - commission);
      const seller = r.seller_id ? sellersMap.get(r.seller_id) ?? null : null;
      const sellerCommission = seller ? round2((total * seller.pct) / 100) : 0;
      return {
        id: r.id,
        artistId: r.artist_id,
        startAt: r.start_at,
        endAt: r.end_at,
        status: r.status,
        contactName: r.contact_name,
        servicesSummary: (r.services ?? [])
          .map((s) => s?.name)
          .filter(Boolean)
          .join(", "),
        totalEur: round2(total),
        commissionEur: commission,
        studioEur: studio,
        bucket: deriveBucket(r.start_at, paidIds.has(r.id), r.manual_payment_status),
        manualOverride: parseManualBucket(r.manual_payment_status) !== null,
        sellerId: r.seller_id,
        sellerName: seller?.name ?? null,
        sellerCommissionEur: sellerCommission,
      };
    });

    let totalBruto = 0;
    let comissaoTotal = 0;
    let estudioTotal = 0;
    let pago = 0;
    let pendente = 0;
    let aReceber = 0;
    let vendedorComissaoTotal = 0;
    for (const r of rows) {
      totalBruto += r.totalEur;
      comissaoTotal += r.commissionEur;
      estudioTotal += r.studioEur;
      vendedorComissaoTotal += r.sellerCommissionEur;
      if (r.bucket === "pago") pago += r.totalEur;
      else if (r.bucket === "pendente") pendente += r.totalEur;
      else aReceber += r.totalEur;
    }

    return {
      role: "admin",
      totalBruto: round2(totalBruto),
      comissaoTotal: round2(comissaoTotal),
      estudioTotal: round2(estudioTotal),
      pago: round2(pago),
      pendente: round2(pendente),
      aReceber: round2(aReceber),
      vendedorComissaoTotal: round2(vendedorComissaoTotal),
      rows,
    };
  });

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function fetchOverrideMap(
  supabase: { from: (t: never) => unknown },
  ids: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (ids.length === 0) return map;
  const { data, error } = await (supabase as {
    from: (t: string) => {
      select: (s: string) => {
        in: (
          k: string,
          v: string[],
        ) => Promise<{ data: Array<{ id: string; manual_payment_status: string | null }> | null; error: { message: string } | null }>;
      };
    };
  })
    .from("appointments")
    .select("id, manual_payment_status")
    .in("id", ids);
  if (error) {
    console.warn("finance fetchOverrideMap failed", error.message);
    return map;
  }
  for (const r of data ?? []) map.set(r.id, r.manual_payment_status);
  return map;
}