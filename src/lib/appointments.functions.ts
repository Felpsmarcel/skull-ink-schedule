import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseManualBucket, type PaymentBucket } from "@/lib/finance.functions";

const ServiceLineSchema = z.object({
  id: z.string().uuid(),
  discountPct: z.number().min(0).max(100).default(0),
  overridePriceEur: z.number().min(0).max(1_000_000).nullable().optional(),
});

const CreateInputSchema = z.object({
  artistId: z.string().uuid(),
  calendarId: z.string().min(5),
  locationId: z.string().min(5),
  contactId: z.string().min(3),
  contactName: z.string().nullish(),
  contactPhone: z.string().nullish(),
  contactEmail: z.string().nullish(),
  startISO: z.string().min(10),
  endISO: z.string().min(10),
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).nullish(),
  status: z
    .enum(["pending", "confirmed", "cancelled", "completed", "no_show"])
    .default("confirmed"),
  services: z.array(ServiceLineSchema).min(1),
  sellerId: z.string().uuid().nullish(),
  depositEur: z.number().min(0).max(1_000_000).default(0),
});

export type CreateAppointmentInput = z.infer<typeof CreateInputSchema>;

export interface CreateAppointmentResult {
  appointmentId: string;
  ghlEventId: string | null;
  totalEur: number;
  commissionPct: number;
  warning?: string;
}

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-04-15";

async function ghlFetch(
  path: string,
  init: { method: string; body?: unknown; token: string },
): Promise<{ status: number; ok: boolean; data: unknown }> {
  const res = await fetch(`${GHL_BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${init.token}`,
      Version: GHL_VERSION,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  let data: unknown = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const createAppointmentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateInputSchema.parse(data))
  .handler(async ({ data, context }): Promise<CreateAppointmentResult> => {
    const { supabase, userId } = context;

    // 1. Authorize: admin OR artist who owns this artistId.
    const { data: meRow, error: meErr } = await supabase
      .from("app_users" as never)
      .select("role, artist_id, seller_id")
      .eq("id", userId)
      .maybeSingle();
    if (meErr) throw new Error(meErr.message);
    const me = meRow as {
      role: "admin" | "artist" | "seller";
      artist_id: string | null;
      seller_id: string | null;
    } | null;
    if (!me) throw new Error("Forbidden: sem perfil");
    if (me.role === "artist") {
      if (me.artist_id !== data.artistId) {
        throw new Error("Forbidden: artistId não pertence ao usuário");
      }
    } else if (me.role === "seller") {
      if (!me.seller_id) throw new Error("Forbidden: vendedor sem vínculo");
      // Trava: vendedor só cria em nome dele mesmo.
      if (data.sellerId && data.sellerId !== me.seller_id) {
        throw new Error("Forbidden: sellerId não confere com o vendedor logado");
      }
      data.sellerId = me.seller_id;
    } else if (me.role !== "admin") {
      throw new Error("Forbidden");
    }

    // 2. Resolve commission_pct from artist (defaults to 40).
    const { data: artistRow, error: artistErr } = await supabase
      .from("artists" as never)
      .select("id, ghl_calendar_id, commission_pct")
      .eq("id", data.artistId)
      .maybeSingle();
    if (artistErr) throw new Error(artistErr.message);
    const artist = artistRow as
      | { id: string; ghl_calendar_id: string | null; commission_pct: number | string | null }
      | null;
    if (!artist) throw new Error("Artist não encontrado");
    if (artist.ghl_calendar_id && artist.ghl_calendar_id !== data.calendarId) {
      throw new Error("calendarId não confere com o artista");
    }
    const commissionPct = Number(artist.commission_pct ?? 40);

    // 3. Server-side price authority: load services from DB.
    const ids = data.services.map((s) => s.id);
    const { data: svcRows, error: svcErr } = await supabase
      .from("services" as never)
      .select("id, name, duration_min, modality, price_eur, price_on_request")
      .in("id", ids);
    if (svcErr) throw new Error(svcErr.message);
    const svcMap = new Map<
      string,
      { id: string; name: string; duration_min: number; modality: string; price_eur: number; price_on_request: boolean }
    >();
    for (const r of (svcRows ?? []) as Array<{
      id: string;
      name: string;
      duration_min: number;
      modality: string;
      price_eur: number | string;
      price_on_request: boolean | null;
    }>) {
      svcMap.set(r.id, {
        ...r,
        price_eur: Number(r.price_eur),
        price_on_request: Boolean(r.price_on_request),
      });
    }
    for (const s of data.services) {
      if (!svcMap.has(s.id)) throw new Error(`Serviço inexistente: ${s.id}`);
    }

    const lines = data.services.map((s) => {
      const svc = svcMap.get(s.id)!;
      const basePrice = svc.price_on_request
        ? Number(s.overridePriceEur ?? 0)
        : Number(s.overridePriceEur ?? svc.price_eur);
      if (svc.price_on_request && !(basePrice > 0)) {
        throw new Error(`Informe o valor do serviço "${svc.name}"`);
      }
      const finalEur = round2(basePrice * (1 - s.discountPct / 100));
      return {
        id: svc.id,
        name: svc.name,
        duration_min: svc.duration_min,
        modality: svc.modality,
        price_eur: basePrice,
        discount_pct: s.discountPct,
        final_eur: finalEur,
      };
    });
    const originalEur = round2(lines.reduce((acc, l) => acc + l.price_eur, 0));
    const totalEur = round2(lines.reduce((acc, l) => acc + l.final_eur, 0));

    const depositEur = round2(Math.max(0, Math.min(data.depositEur ?? 0, totalEur)));

    // 4. Create event in GHL.
    const token = process.env.GHL_TOKEN;
    if (!token) throw new Error("GHL_TOKEN ausente no servidor");

    const ghlStatus =
      data.status === "pending" || data.status === "cancelled" ? "new" : "confirmed";
    const ghlRes = await ghlFetch("/calendars/events/appointments", {
      method: "POST",
      token,
      body: {
        calendarId: data.calendarId,
        locationId: data.locationId,
        contactId: data.contactId,
        startTime: data.startISO,
        endTime: data.endISO,
        title: data.title,
        appointmentStatus: ghlStatus,
        notes: data.notes ?? undefined,
        ignoreFreeSlotValidation: false,
      },
    });
    if (!ghlRes.ok) {
      const msg =
        (ghlRes.data as { message?: string } | null)?.message ??
        `GHL ${ghlRes.status}: ${JSON.stringify(ghlRes.data)}`;
      throw new Error(msg);
    }
    const ghlEventId = (ghlRes.data as { id?: string } | null)?.id ?? null;

    // 5. Mirror in Supabase via service role (bypasses RLS).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      ghl_appointment_id: ghlEventId,
      ghl_contact_id: data.contactId,
      artist_id: data.artistId,
      calendar_id: data.calendarId,
      contact_name: data.contactName ?? null,
      contact_phone: data.contactPhone ?? null,
      contact_email: data.contactEmail ?? null,
      start_at: data.startISO,
      end_at: data.endISO,
      status: data.status,
      total_eur: totalEur,
      original_eur: originalEur,
      commission_pct: commissionPct,
      services: lines,
      notes: data.notes ?? null,
      seller_id: data.sellerId ?? null,
      deposit_eur: depositEur,
    };
    const { data: ins, error: insErr } = await supabaseAdmin
      .from("appointments" as never)
      .insert(row as never)
      .select("id")
      .single();

    if (insErr || !ins) {
      // Compensate: try to delete the GHL event so we don't leave an orphan.
      let warning: string | undefined;
      if (ghlEventId) {
        const del = await ghlFetch(`/calendars/events/${ghlEventId}`, {
          method: "DELETE",
          token,
        });
        if (!del.ok) {
          warning = `Evento ${ghlEventId} criado no GHL mas falhou ao deletar (${del.status}). Reconcilie manualmente.`;
          console.error("[createAppointmentRecord] GHL delete compensation failed", {
            ghlEventId,
            status: del.status,
          });
          // Persist for admin reconciliation UI.
          try {
            await supabaseAdmin.from("ghl_sync_failures" as never).insert({
              ghl_event_id: ghlEventId,
              reason: `Insert no banco falhou e compensação no GHL também: ${insErr?.message ?? "unknown"} (delete status ${del.status})`,
              payload: {
                row,
                ghl_delete_status: del.status,
                ghl_delete_response: del.data,
              },
            } as never);
          } catch (logErr) {
            console.error("[createAppointmentRecord] failed to record sync failure", logErr);
          }
        }
      }
      throw new Error(
        `Falha ao salvar no banco: ${insErr?.message ?? "sem dado"}${warning ? ` · ${warning}` : ""}`,
      );
    }

    const inserted = ins as { id: string };

    // If the client already paid a deposit, register it as a partial payment.
    if (depositEur > 0) {
      try {
        // Ensure a contacts row exists so payments.contact_id can be set.
        let contactId: string | null = null;
        const { data: upserted } = await supabaseAdmin
          .from("contacts" as never)
          .upsert(
            {
              ghl_contact_id: data.contactId,
              name: data.contactName?.trim() || "Sem nome",
              email: data.contactEmail ?? null,
              phone: data.contactPhone ?? null,
            } as never,
            { onConflict: "ghl_contact_id" },
          )
          .select("id")
          .single();
        contactId = (upserted as { id: string } | null)?.id ?? null;
        if (contactId) {
          await supabaseAdmin
            .from("appointments" as never)
            .update({ contact_id: contactId } as never)
            .eq("id", inserted.id);
          await supabaseAdmin.from("payments" as never).insert({
            appointment_id: inserted.id,
            contact_id: contactId,
            amount_eur: depositEur,
            type: "deposit",
            method: "other",
            status: "paid",
            paid_at: new Date().toISOString(),
            notes: "Sinal registrado no agendamento",
            created_by: userId,
          } as never);
        }
      } catch (depErr) {
        console.error("[createAppointmentRecord] deposit registration failed", depErr);
      }
    }

    return {
      appointmentId: inserted.id,
      ghlEventId,
      totalEur,
      commissionPct,
    };
  });

/* =========================================================
 *  Finance from Agenda: read + upsert + register payment
 * ========================================================= */

export interface AppointmentFinanceLine {
  service_id: string;
  name: string;
  duration_min: number;
  price_eur: number;
  quantity: number;
}

export interface AppointmentFinanceView {
  visible: boolean;
  appointmentId: string | null;
  role: "admin" | "artist" | "none";
  isOwner: boolean;
  totalEur: number | null;
  originalEur: number | null;
  discountEur: number | null;
  commissionPct: number | null;
  commissionEur: number | null;
  depositEur: number;
  services: AppointmentFinanceLine[];
  payments: Array<{
    id: string;
    amount_eur: number;
    type: "deposit" | "final" | "refund";
    method: "cash" | "card" | "transfer" | "payconiq" | "other";
    status: "pending" | "paid" | "refunded";
    paid_at: string | null;
    notes: string | null;
  }>;
  paidTotalEur: number;
  balanceEur: number | null;
  manualPaymentStatus: PaymentBucket | null;
  seller: {
    id: string;
    name: string;
    commissionPct: number;
    commissionEur: number;
  } | null;
}

async function authorizeArtistOrAdmin(
  supabase: ReturnType<typeof createServerFn> extends never ? never : any, // eslint-disable-line @typescript-eslint/no-explicit-any
  userId: string,
): Promise<{ role: "admin" | "artist"; artistId: string | null }> {
  const { data: meRow, error: meErr } = await supabase
    .from("app_users" as never)
    .select("role, artist_id")
    .eq("id", userId)
    .maybeSingle();
  if (meErr) throw new Error(meErr.message);
  const me = meRow as { role: "admin" | "artist"; artist_id: string | null } | null;
  if (!me) throw new Error("Forbidden: sem perfil");
  return { role: me.role, artistId: me.artist_id };
}

export const getAppointmentFinanceByGhlId = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ ghlEventId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<AppointmentFinanceView> => {
    const { supabase, userId } = context;
    const me = await authorizeArtistOrAdmin(supabase, userId);

    // Read the appointment row via RLS (artist policy only returns own rows).
    const { data: apptRow, error: apptErr } = await supabase
      .from("appointments" as never)
      .select(
        "id, artist_id, total_eur, original_eur, discount_eur, commission_pct, services, manual_payment_status, seller_id, deposit_eur",
      )
      .eq("ghl_appointment_id", data.ghlEventId)
      .maybeSingle();
    if (apptErr) throw new Error(apptErr.message);
    const appt = apptRow as
      | {
          id: string;
          artist_id: string;
          total_eur: number | string | null;
          original_eur: number | string | null;
          discount_eur: number | string | null;
          commission_pct: number | string | null;
          services: unknown;
          manual_payment_status: string | null;
          seller_id: string | null;
          deposit_eur: number | string | null;
        }
      | null;

    if (!appt) {
      return {
        visible: false,
        appointmentId: null,
        role: me.role,
        isOwner: false,
        totalEur: null,
        originalEur: null,
        discountEur: null,
        commissionPct: null,
        commissionEur: null,
        depositEur: 0,
        services: [],
        payments: [],
        paidTotalEur: 0,
        balanceEur: null,
        manualPaymentStatus: null,
        seller: null,
      };
    }

    const isOwner = me.role === "admin" || appt.artist_id === me.artistId;
    if (!isOwner) {
      return {
        visible: false,
        appointmentId: appt.id,
        role: me.role,
        isOwner: false,
        totalEur: null,
        originalEur: null,
        discountEur: null,
        commissionPct: null,
        commissionEur: null,
        depositEur: 0,
        services: [],
        payments: [],
        paidTotalEur: 0,
        balanceEur: null,
        manualPaymentStatus: null,
        seller: null,
      };
    }

    const { data: svcRows } = await supabase
      .from("appointment_services" as never)
      .select("service_id, price_eur, duration_min, quantity")
      .eq("appointment_id", appt.id);
    const { data: svcMeta } = await supabase
      .from("services" as never)
      .select("id, name")
      .in(
        "id",
        (
          (svcRows ?? []) as Array<{ service_id: string }>
        ).map((r) => r.service_id),
      );
    const nameMap = new Map<string, string>();
    for (const s of (svcMeta ?? []) as Array<{ id: string; name: string }>) {
      nameMap.set(s.id, s.name);
    }
    const services: AppointmentFinanceLine[] = (
      (svcRows ?? []) as Array<{
        service_id: string;
        price_eur: number | string;
        duration_min: number;
        quantity: number;
      }>
    ).map((r) => ({
      service_id: r.service_id,
      name: nameMap.get(r.service_id) ?? "Serviço",
      price_eur: Number(r.price_eur),
      duration_min: r.duration_min,
      quantity: r.quantity,
    }));

    const { data: payRows } = await supabase
      .from("payments" as never)
      .select("id, amount_eur, type, method, status, paid_at, notes")
      .eq("appointment_id", appt.id)
      .order("paid_at", { ascending: false });
    const payments = ((payRows ?? []) as Array<{
      id: string;
      amount_eur: number | string;
      type: "deposit" | "final" | "refund";
      method: "cash" | "card" | "transfer" | "payconiq" | "other";
      status: "pending" | "paid" | "refunded";
      paid_at: string | null;
      notes: string | null;
    }>).map((p) => ({
      ...p,
      amount_eur: Number(p.amount_eur),
    }));

    const totalEur = appt.total_eur == null ? null : Number(appt.total_eur);
    const originalEur = appt.original_eur == null ? null : Number(appt.original_eur);
    const discountEur = appt.discount_eur == null ? null : Number(appt.discount_eur);
    const commissionPct = appt.commission_pct == null ? null : Number(appt.commission_pct);
    const commissionEur =
      totalEur != null && commissionPct != null
        ? round2((totalEur * commissionPct) / 100)
        : null;
    const paidTotalEur = round2(
      payments
        .filter((p) => p.status === "paid" && p.type !== "refund")
        .reduce((n, p) => n + Number(p.amount_eur), 0) -
        payments
          .filter((p) => p.status === "paid" && p.type === "refund")
          .reduce((n, p) => n + Number(p.amount_eur), 0),
    );
    const balanceEur = totalEur == null ? null : round2(totalEur - paidTotalEur);

    let seller: AppointmentFinanceView["seller"] = null;
    if (appt.seller_id) {
      const { data: sellerRow } = await (supabase as any)
        .from("sellers" as never)
        .select("id, name, commission_pct")
        .eq("id", appt.seller_id)
        .maybeSingle();
      if (sellerRow) {
        const s = sellerRow as { id: string; name: string; commission_pct: number | string };
        const pct = Number(s.commission_pct);
        seller = {
          id: s.id,
          name: s.name,
          commissionPct: pct,
          commissionEur: totalEur != null ? round2((totalEur * pct) / 100) : 0,
        };
      }
    }

    return {
      visible: true,
      appointmentId: appt.id,
      role: me.role,
      isOwner: true,
      totalEur,
      originalEur,
      discountEur,
      commissionPct,
      commissionEur,
      depositEur: appt.deposit_eur == null ? 0 : Number(appt.deposit_eur),
      services,
      payments,
      paidTotalEur,
      balanceEur,
      manualPaymentStatus: parseManualBucket(appt.manual_payment_status),
      seller,
    };
  });

const ServiceLineInputSchema = z.object({
  serviceId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20).default(1),
});

const UpsertFinanceSchema = z.object({
  ghlEventId: z.string().min(1),
  totalEur: z.number().min(0).max(1_000_000).nullable(),
  discountEur: z.number().min(0).max(1_000_000).default(0),
  commissionPct: z.number().min(0).max(100).nullable(),
  services: z.array(ServiceLineInputSchema).max(20).default([]),
});

export const upsertAppointmentFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpsertFinanceSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const me = await authorizeArtistOrAdmin(supabase, userId);

    // Load the appointment row via RLS to check ownership.
    const { data: apptRow, error: apptErr } = await supabase
      .from("appointments" as never)
      .select("id, artist_id, commission_pct")
      .eq("ghl_appointment_id", data.ghlEventId)
      .maybeSingle();
    if (apptErr) throw new Error(apptErr.message);
    const appt = apptRow as
      | { id: string; artist_id: string; commission_pct: number | string | null }
      | null;
    if (!appt) {
      throw new Error(
        "Agendamento ainda não sincronizado no banco. Aguarde a próxima sincronização ou peça ao admin para sincronizar.",
      );
    }
    if (me.role !== "admin" && appt.artist_id !== me.artistId) {
      throw new Error("Forbidden: não é seu agendamento");
    }

    // Compute totals: if services provided, sum them; else use free total.
    let originalEur = 0;
    let servicesJsonb: Array<{
      id: string;
      name: string;
      duration_min: number;
      modality: string;
      price_eur: number;
      quantity: number;
    }> = [];
    let apptSvcRows: Array<{
      appointment_id: string;
      service_id: string;
      price_eur: number;
      duration_min: number;
      quantity: number;
    }> = [];

    if (data.services.length > 0) {
      const ids = data.services.map((s) => s.serviceId);
      const { data: svcRows, error: svcErr } = await supabase
        .from("services" as never)
        .select("id, name, duration_min, modality, price_eur")
        .in("id", ids);
      if (svcErr) throw new Error(svcErr.message);
      const svcMap = new Map<
        string,
        {
          id: string;
          name: string;
          duration_min: number;
          modality: string;
          price_eur: number;
        }
      >();
      for (const r of (svcRows ?? []) as Array<{
        id: string;
        name: string;
        duration_min: number;
        modality: string;
        price_eur: number | string;
      }>) {
        svcMap.set(r.id, { ...r, price_eur: Number(r.price_eur) });
      }
      for (const s of data.services) {
        if (!svcMap.has(s.serviceId))
          throw new Error(`Serviço inexistente: ${s.serviceId}`);
      }
      servicesJsonb = data.services.map((s) => {
        const svc = svcMap.get(s.serviceId)!;
        return { ...svc, quantity: s.quantity };
      });
      apptSvcRows = data.services.map((s) => {
        const svc = svcMap.get(s.serviceId)!;
        return {
          appointment_id: appt.id,
          service_id: svc.id,
          price_eur: svc.price_eur,
          duration_min: svc.duration_min,
          quantity: s.quantity,
        };
      });
      originalEur = round2(
        servicesJsonb.reduce((n, l) => n + l.price_eur * l.quantity, 0),
      );
    }

    // Resolve final totalEur: explicit override wins; else derived from services minus discount.
    let totalEur: number;
    if (data.totalEur != null) {
      totalEur = round2(data.totalEur);
      if (originalEur === 0) originalEur = round2(totalEur + data.discountEur);
    } else {
      if (originalEur === 0)
        throw new Error("Informe um valor total ou selecione serviços.");
      totalEur = round2(Math.max(0, originalEur - data.discountEur));
    }

    const commissionPct =
      data.commissionPct != null
        ? data.commissionPct
        : Number(appt.commission_pct ?? 40);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: updErr } = await supabaseAdmin
      .from("appointments" as never)
      .update({
        total_eur: totalEur,
        original_eur: originalEur,
        discount_eur: round2(data.discountEur),
        commission_pct: commissionPct,
        services: servicesJsonb,
      } as never)
      .eq("id", appt.id);
    if (updErr) throw new Error(updErr.message);

    // Replace appointment_services line items.
    const { error: delErr } = await supabaseAdmin
      .from("appointment_services" as never)
      .delete()
      .eq("appointment_id", appt.id);
    if (delErr) throw new Error(delErr.message);
    if (apptSvcRows.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from("appointment_services" as never)
        .insert(apptSvcRows as never);
      if (insErr) throw new Error(insErr.message);
    }

    return {
      appointmentId: appt.id,
      totalEur,
      originalEur,
      commissionPct,
      commissionEur: round2((totalEur * commissionPct) / 100),
    };
  });

const RegisterPaymentSchema = z.object({
  ghlEventId: z.string().min(1),
  amountEur: z.number().min(0.01).max(1_000_000),
  type: z.enum(["deposit", "final", "refund"]),
  method: z.enum(["cash", "card", "transfer", "payconiq", "other"]),
  status: z.enum(["pending", "paid", "refunded"]).default("paid"),
  paidAtISO: z.string().nullish(),
  notes: z.string().max(500).nullish(),
});

export const registerAppointmentPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RegisterPaymentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const me = await authorizeArtistOrAdmin(supabase, userId);

    const { data: apptRow, error: apptErr } = await supabase
      .from("appointments" as never)
      .select("id, artist_id, contact_id, ghl_contact_id, contact_name, contact_email, contact_phone")
      .eq("ghl_appointment_id", data.ghlEventId)
      .maybeSingle();
    if (apptErr) throw new Error(apptErr.message);
    const appt = apptRow as
      | {
          id: string;
          artist_id: string;
          contact_id: string | null;
          ghl_contact_id: string | null;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
        }
      | null;
    if (!appt) throw new Error("Agendamento não encontrado no banco.");
    if (me.role !== "admin" && appt.artist_id !== me.artistId) {
      throw new Error("Forbidden: não é seu agendamento");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve contact_id (backfill if missing) so we can insert the payment.
    let contactId = appt.contact_id;
    if (!contactId) {
      if (!appt.ghl_contact_id) {
        throw new Error(
          "Agendamento sem contato vinculado — vincule um cliente antes de registrar o pagamento.",
        );
      }
      const { data: upserted, error: upsertErr } = await supabaseAdmin
        .from("contacts" as never)
        .upsert(
          {
            ghl_contact_id: appt.ghl_contact_id,
            name: appt.contact_name?.trim() || "Sem nome",
            email: appt.contact_email ?? null,
            phone: appt.contact_phone ?? null,
          } as never,
          { onConflict: "ghl_contact_id" },
        )
        .select("id")
        .single();
      if (upsertErr || !upserted) {
        throw new Error(
          `Falha ao vincular contato: ${upsertErr?.message ?? "sem dado"}`,
        );
      }
      contactId = (upserted as { id: string }).id;
      await supabaseAdmin
        .from("appointments" as never)
        .update({ contact_id: contactId } as never)
        .eq("id", appt.id);
    }

    const { data: ins, error: insErr } = await supabaseAdmin
      .from("payments" as never)
      .insert({
        appointment_id: appt.id,
        contact_id: contactId,
        amount_eur: round2(data.amountEur),
        type: data.type,
        method: data.method,
        status: data.status,
        paid_at: data.paidAtISO ?? new Date().toISOString(),
        notes: data.notes ?? null,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (insErr || !ins) throw new Error(insErr?.message ?? "Falha ao registrar pagamento");
    return { paymentId: (ins as { id: string }).id };
  });

const SetStatusSchema = z.object({
  ghlEventId: z.string().min(1),
  status: z.enum(["pago", "pendente", "a_receber"]).nullable(),
});

export const setAppointmentPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SetStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const me = await authorizeArtistOrAdmin(supabase, userId);

    const { data: apptRow, error: apptErr } = await supabase
      .from("appointments" as never)
      .select("id, artist_id")
      .eq("ghl_appointment_id", data.ghlEventId)
      .maybeSingle();
    if (apptErr) throw new Error(apptErr.message);
    const appt = apptRow as { id: string; artist_id: string } | null;
    if (!appt) throw new Error("Agendamento não encontrado no banco.");
    if (me.role !== "admin" && appt.artist_id !== me.artistId) {
      throw new Error("Forbidden: não é seu agendamento");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updErr } = await supabaseAdmin
      .from("appointments" as never)
      .update({
        manual_payment_status: data.status,
        manual_payment_status_by: data.status ? userId : null,
        manual_payment_status_at: data.status ? new Date().toISOString() : null,
      } as never)
      .eq("id", appt.id);
    if (updErr) throw new Error(updErr.message);

    return { appointmentId: appt.id, manualPaymentStatus: data.status };
  });

const SetSellerSchema = z.object({
  ghlEventId: z.string().min(1),
  sellerId: z.string().uuid().nullable(),
});

export const setAppointmentSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SetSellerSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const me = await authorizeArtistOrAdmin(supabase, userId);

    const { data: apptRow, error: apptErr } = await supabase
      .from("appointments" as never)
      .select("id, artist_id")
      .eq("ghl_appointment_id", data.ghlEventId)
      .maybeSingle();
    if (apptErr) throw new Error(apptErr.message);
    const appt = apptRow as { id: string; artist_id: string } | null;
    if (!appt) throw new Error("Agendamento não encontrado no banco.");
    if (me.role !== "admin" && appt.artist_id !== me.artistId) {
      throw new Error("Forbidden: não é seu agendamento");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updErr } = await supabaseAdmin
      .from("appointments" as never)
      .update({ seller_id: data.sellerId } as never)
      .eq("id", appt.id);
    if (updErr) throw new Error(updErr.message);

    return { appointmentId: appt.id, sellerId: data.sellerId };
  });