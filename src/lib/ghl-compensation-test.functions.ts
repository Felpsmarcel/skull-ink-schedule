import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LOCATION_ID } from "@/config/staff";

/**
 * Admin-only smoke test for the GHL compensation path used by
 * `createAppointmentRecord`. Creates a real GHL event, then immediately
 * runs the SAME DELETE call the compensation branch uses. If DELETE returns
 * ok, the compensation primitive is healthy.
 *
 * On failure, leaves the event in GHL and writes a row to
 * `ghl_sync_failures` so the admin sees it in /reconciliar.
 *
 * Run from the admin GHL test page. Idempotent: each invocation creates
 * AND deletes one event.
 */

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-04-15";

const Input = z.object({
  calendarId: z.string().min(5),
  contactId: z.string().min(3),
  startISO: z.string().min(10),
  endISO: z.string().min(10),
});

export interface CompensationTestResult {
  ok: boolean;
  ghlEventId: string | null;
  createStatus: number;
  deleteStatus: number | null;
  notes: string;
}

export const testGhlCompensation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<CompensationTestResult> => {
    const { supabase, userId } = context;
    const { data: meRow } = await supabase
      .from("app_users" as never)
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    const role = (meRow as { role?: string } | null)?.role;
    if (role !== "admin") throw new Error("Apenas admin");

    const token = process.env.GHL_TOKEN;
    if (!token) throw new Error("GHL_TOKEN ausente");

    const baseHeaders = {
      Authorization: `Bearer ${token}`,
      Version: GHL_VERSION,
      Accept: "application/json",
    };

    const createRes = await fetch(`${GHL_BASE}/calendars/events/appointments`, {
      method: "POST",
      headers: { ...baseHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        calendarId: data.calendarId,
        locationId: LOCATION_ID,
        contactId: data.contactId,
        startTime: data.startISO,
        endTime: data.endISO,
        title: "[compensation-test] auto-delete",
        appointmentStatus: "new",
        ignoreFreeSlotValidation: true,
      }),
    });
    const createText = await createRes.text();
    let createBody: unknown = null;
    try {
      createBody = createText ? JSON.parse(createText) : null;
    } catch {
      createBody = createText;
    }
    if (!createRes.ok) {
      return {
        ok: false,
        ghlEventId: null,
        createStatus: createRes.status,
        deleteStatus: null,
        notes: `Create falhou: ${JSON.stringify(createBody)}`,
      };
    }
    const ghlEventId = (createBody as { id?: string } | null)?.id ?? null;
    if (!ghlEventId) {
      return {
        ok: false,
        ghlEventId: null,
        createStatus: createRes.status,
        deleteStatus: null,
        notes: "Create OK mas sem id no payload",
      };
    }

    const delRes = await fetch(`${GHL_BASE}/calendars/events/${ghlEventId}`, {
      method: "DELETE",
      headers: baseHeaders,
    });
    if (!delRes.ok) {
      // Record the orphan exactly like the real compensation branch does.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("ghl_sync_failures" as never).insert({
        ghl_event_id: ghlEventId,
        reason: `[compensation-test] DELETE retornou ${delRes.status}`,
        payload: { ghlEventId, deleteStatus: delRes.status },
      } as never);
      return {
        ok: false,
        ghlEventId,
        createStatus: createRes.status,
        deleteStatus: delRes.status,
        notes: `DELETE falhou — registrado em ghl_sync_failures`,
      };
    }
    return {
      ok: true,
      ghlEventId,
      createStatus: createRes.status,
      deleteStatus: delRes.status,
      notes: "Create + Delete OK. Compensação funcional.",
    };
  });