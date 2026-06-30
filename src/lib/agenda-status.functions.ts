import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { deriveBucket, type PaymentBucket } from "@/lib/finance.functions";
import { brusselsDayStartMs, brusselsDayEndMs } from "@/lib/agenda-grid";

export interface DayAppointmentStatus {
  ghlAppointmentId: string;
  artistId: string;
  bucket: PaymentBucket;
}

export const getDayAppointmentStatuses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dateISO: string }) => input)
  .handler(async ({ data, context }): Promise<DayAppointmentStatus[]> => {
    const { supabase } = context;
    const day = new Date(data.dateISO);
    if (Number.isNaN(day.getTime())) return [];
    const startISO = new Date(brusselsDayStartMs(day)).toISOString();
    const endISO = new Date(brusselsDayEndMs(day)).toISOString();
    return queryStatuses(supabase, startISO, endISO);
  });

export const getRangeAppointmentStatuses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { startISO: string; endISO: string }) => input)
  .handler(async ({ data, context }): Promise<DayAppointmentStatus[]> => {
    if (!data.startISO || !data.endISO) return [];
    return queryStatuses(context.supabase, data.startISO, data.endISO);
  });

async function queryStatuses(
  supabase: { from: (t: never) => any },
  startISO: string,
  endISO: string,
): Promise<DayAppointmentStatus[]> {
    const { data: rows, error } = await (supabase as any)
      .from("appointments" as never)
      .select("id, artist_id, ghl_appointment_id, start_at")
      .gte("start_at", startISO)
      .lte("start_at", endISO)
      .not("ghl_appointment_id", "is", null);
    if (error) throw new Error(error.message);

    const appts = (rows ?? []) as Array<{
      id: string;
      artist_id: string;
      ghl_appointment_id: string;
      start_at: string;
    }>;
    if (appts.length === 0) return [];

    const ids = appts.map((a) => a.id);
    const { data: payRows, error: payErr } = await (supabase as any)
      .from("payments" as never)
      .select("appointment_id, status")
      .eq("status", "paid")
      .in("appointment_id", ids);
    if (payErr) throw new Error(payErr.message);
    const paidIds = new Set(
      ((payRows ?? []) as Array<{ appointment_id: string | null }>)
        .map((r) => r.appointment_id)
        .filter((x): x is string => Boolean(x)),
    );

    return appts.map((a) => ({
      ghlAppointmentId: a.ghl_appointment_id,
      artistId: a.artist_id,
      bucket: deriveBucket(a.start_at, paidIds.has(a.id)),
    }));
}