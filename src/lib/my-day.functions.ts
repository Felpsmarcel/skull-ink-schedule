import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canReadMyDay, correlateMyDay, myDayBounds, type DayAppointment, type DayCheckin } from "@/lib/my-day-core";

/** Independent read projection: no CRM calls, writes, privileged client or broad RPC. */
export const getMyDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: me, error } = await supabase.from("app_users").select("role").eq("id", userId).maybeSingle();
    if (error || !canReadMyDay(me?.role)) throw new Error("Acesso não autorizado");
    const bounds = myDayBounds(new Date());
    const appointments: DayAppointment[] = [];
    const checkins: DayCheckin[] = [];
    // Explicit bounded pagination. Hitting the safety cap is an error, not a complete total.
    for (let page = 0; ; page++) {
      if (page >= 40) throw new Error("Leitura do dia incompleta");
      const { data, error: readError } = await supabase.from("appointments")
        .select("id, ghl_appointment_id, contact_name, artist_id, artists(name), start_at, status")
        .gte("start_at", bounds.start).lt("start_at", bounds.end)
        .order("start_at").order("id").range(page * 250, page * 250 + 249);
      if (readError || !data) throw new Error("Agenda do dia indisponível");
      appointments.push(...data.map(a => ({ id: a.id, ghlId: a.ghl_appointment_id, name: a.contact_name || "Cliente sem nome", artist: (a.artists as { name: string } | null)?.name ?? null, start: a.start_at, status: a.status })));
      if (data.length < 250) break;
    }
    // Include today's arrivals and check-ins linked to today's sessions, even if arrival was yesterday.
    const unique = new Map<string, DayCheckin>();
    const selections = ["today", ...Array.from({ length: Math.ceil(appointments.length / 100) }, (_, i) => `chunk-${i}`)];
    for (let chunk = 0; chunk < selections.length; chunk++) {
      for (let page = 0; ; page++) {
        if (page >= 40) throw new Error("Leitura de chegadas incompleta");
        let query = supabase.from("checkins").select("id, appointment_id, ghl_appointment_id, cliente_nome, status, arrived_at, started_at, finished_at");
        if (chunk === 0) query = query.gte("arrived_at", bounds.start).lt("arrived_at", bounds.end);
        else {
          const ids = appointments.slice((chunk - 1) * 100, chunk * 100).map(a => a.id);
          query = query.in("appointment_id", ids);
        }
        const { data, error: readError } = await query.order("arrived_at").order("id").range(page * 250, page * 250 + 249);
        if (readError || !data) throw new Error("Chegadas do dia indisponíveis");
        for (const c of data) unique.set(c.id, { id: c.id, appointmentId: c.appointment_id, ghlId: c.ghl_appointment_id, name: c.cliente_nome, status: c.status, arrived: c.arrived_at, started: c.started_at, finished: c.finished_at });
        if (data.length < 250) break;
      }
    }
    checkins.push(...unique.values());
    return { ...correlateMyDay(appointments, checkins), day: bounds.day, updatedAt: new Date().toISOString(), source: "Espelho local · Agenda e chegadas" };
  });