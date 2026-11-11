import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  correlateMyDay,
  myDayBounds,
  myDaySummary,
  type DayAppointment,
  type DayCheckin,
} from "@/lib/my-day-core";

import { readMyDayPages, requireMyDayAdmin } from "@/lib/my-day-read";

/** Independent read projection: no CRM calls, writes, privileged client or broad RPC. */
export const getMyDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: me, error } = await supabase
      .from("app_users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    requireMyDayAdmin(error ? null : me?.role);
    const bounds = myDayBounds(new Date());
    const appointmentRead = async (): Promise<DayAppointment[]> => {
      const rows = await readMyDayPages(async (from, to) => await supabase.from("appointments")
        .select("id, ghl_appointment_id, contact_name, artists(name), start_at, status")
        .gte("start_at", bounds.start).lt("start_at", bounds.end)
        .order("start_at").order("id").range(from, to));
      return rows.map(a => ({ id: a.id, ghlId: a.ghl_appointment_id, name: a.contact_name || "Cliente sem nome", artist: (a.artists as { name: string } | null)?.name ?? null, start: a.start_at, status: a.status }));
    };
    const checkinRead = async (): Promise<DayCheckin[]> => {
      const rows = await readMyDayPages(async (from, to) => await supabase.from("checkins")
        .select("id, appointment_id, ghl_appointment_id, cliente_nome, status, arrived_at, started_at, finished_at")
        .gte("arrived_at", bounds.start).lt("arrived_at", bounds.end)
        .order("arrived_at").order("id").range(from, to));
      return rows.map(c => ({ id: c.id, appointmentId: c.appointment_id, ghlId: c.ghl_appointment_id, name: c.cliente_nome, status: c.status, arrived: c.arrived_at, started: c.started_at, finished: c.finished_at }));
    };
    const [agenda, arrivals] = await Promise.allSettled([appointmentRead(), checkinRead()]);
    const appointments = agenda.status === "fulfilled" ? agenda.value : null;
    const checkins = arrivals.status === "fulfilled" ? arrivals.value : null;
    const result = correlateMyDay(appointments ?? [], checkins ?? []);
    return {
      ...result,
      summary: myDaySummary(appointments ? result.rows : null, checkins),
      coverage: { appointments: appointments !== null, checkins: checkins !== null },
      day: bounds.day,
      updatedAt: new Date().toISOString(),
      source: "Espelho local · não comprova cobertura integral do GHL",
    };
  });
