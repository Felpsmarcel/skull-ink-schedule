import { createServerFn } from "@tanstack/react-start";
import { formatInTimeZone } from "date-fns-tz";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  agendaMoneyCents,
  type AgendaValuesSource,
  type AgendaValueItem,
} from "@/lib/agenda-values-core";
import { readMyDayPages } from "@/lib/my-day-read";

const instantSchema = z.string().datetime({ offset: true });
export const agendaValuesRangeSchema = z
  .object({
    startISO: instantSchema,
    endISO: instantSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const start = Date.parse(value.startISO);
    const end = Date.parse(value.endISO);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    const civilInstant = (ms: number) =>
      Date.parse(`${formatInTimeZone(ms, "Europe/Brussels", "yyyy-MM-dd'T'HH:mm:ss.SSS")}Z`);
    const civilDuration = civilInstant(end) - civilInstant(start);
    if (end <= start || civilDuration <= 0 || civilDuration > 42 * 86_400_000) {
      context.addIssue({ code: "custom", message: "Período deve ter até 42 dias em Bruxelas." });
    }
  });

const idSchema = z
  .string()
  .min(1)
  .refine((value) => value === value.trim());
const annotationSchema = z.object({
  id: idSchema,
  artist_id: idSchema,
  calendar_id: idSchema.nullable(),
  ghl_appointment_id: idSchema.nullable(),
  start_at: instantSchema,
  total_eur: z.unknown(),
  deposit_eur: z.unknown(),
  project_id: idSchema.nullable(),
});

/** Admin-only local read. No CRM calls, privileged client, payment query or writes. */
export const getAgendaValues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => agendaValuesRangeSchema.parse(input))
  .handler(async ({ context, data }): Promise<AgendaValuesSource> => {
    const { supabase, userId } = context;
    const { data: profile, error: profileError } = await supabase
      .from("app_users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (profileError || profile?.role !== "admin") {
      throw new Response("Acesso não autorizado", { status: 403 });
    }
    try {
      let count: number | null = null;
      const rows = await readMyDayPages(async (from, to) => {
        const page = await supabase
          .from("appointments")
          .select(
            "id,artist_id,calendar_id,ghl_appointment_id,start_at,total_eur,deposit_eur,project_id",
            { count: "exact" },
          )
          .gte("start_at", data.startISO)
          .lt("start_at", data.endISO)
          .order("id")
          .range(from, to);
        if (
          page.count === null ||
          !Number.isSafeInteger(page.count) ||
          page.count < 0 ||
          (count !== null && page.count !== count)
        )
          throw new Error("Cobertura não verificada");
        count = page.count;
        return page;
      });
      if (rows.length !== count) throw new Error("Cobertura incompleta");
      const ids = new Set<string>();
      const eventIds = new Set<string>();
      const items: AgendaValueItem[] = [];
      for (const raw of rows) {
        const row = annotationSchema.parse(raw);
        const start = Date.parse(row.start_at);
        if (
          ids.has(row.id) ||
          start < Date.parse(data.startISO) ||
          start >= Date.parse(data.endISO)
        ) {
          throw new Error("Registro divergente");
        }
        ids.add(row.id);
        // A local-only appointment cannot establish the identity of a displayed CRM event.
        if (row.ghl_appointment_id === null) continue;
        if (!row.calendar_id || eventIds.has(row.ghl_appointment_id))
          throw new Error("Vínculo divergente");
        eventIds.add(row.ghl_appointment_id);
        const total = agendaMoneyCents(row.total_eur);
        const deposit = agendaMoneyCents(row.deposit_eur);
        // Imported rows use 0/0 defaults. That pair provides no evidence of a free session.
        const defaultPair = total === 0 && deposit === 0;
        items.push({
          ghlEventId: row.ghl_appointment_id,
          artistId: row.artist_id,
          calendarId: row.calendar_id,
          startTime: row.start_at,
          totalCents: defaultPair ? null : total,
          depositCents: defaultPair ? null : deposit,
          projectId: row.project_id,
        });
      }
      return { state: "ready", items };
    } catch {
      return {
        state: "unavailable",
        items: [],
        reason: "Não foi possível verificar os valores locais deste período.",
      };
    }
  });
