import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ServiceLineSchema = z.object({
  id: z.string().uuid(),
  discountPct: z.number().min(0).max(100).default(0),
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
      .select("role, artist_id")
      .eq("id", userId)
      .maybeSingle();
    if (meErr) throw new Error(meErr.message);
    const me = meRow as { role: "admin" | "artist"; artist_id: string | null } | null;
    if (!me) throw new Error("Forbidden: sem perfil");
    if (me.role !== "admin" && !(me.role === "artist" && me.artist_id === data.artistId)) {
      throw new Error("Forbidden: artistId não pertence ao usuário");
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
      .select("id, name, duration_min, modality, price_eur")
      .in("id", ids);
    if (svcErr) throw new Error(svcErr.message);
    const svcMap = new Map<
      string,
      { id: string; name: string; duration_min: number; modality: string; price_eur: number }
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
      if (!svcMap.has(s.id)) throw new Error(`Serviço inexistente: ${s.id}`);
    }

    const lines = data.services.map((s) => {
      const svc = svcMap.get(s.id)!;
      const finalEur = round2(svc.price_eur * (1 - s.discountPct / 100));
      return {
        id: svc.id,
        name: svc.name,
        duration_min: svc.duration_min,
        modality: svc.modality,
        price_eur: svc.price_eur,
        discount_pct: s.discountPct,
        final_eur: finalEur,
      };
    });
    const originalEur = round2(lines.reduce((acc, l) => acc + l.price_eur, 0));
    const totalEur = round2(lines.reduce((acc, l) => acc + l.final_eur, 0));

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
    return {
      appointmentId: inserted.id,
      ghlEventId,
      totalEur,
      commissionPct,
    };
  });