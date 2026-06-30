import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SyncResult } from "@/lib/sync.server";

export type { SyncResult } from "@/lib/sync.server";

export const runGhlSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SyncResult> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("app_users" as never)
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const role = (data as { role: string } | null)?.role;
    if (role !== "admin") throw new Error("Apenas administradores podem rodar a sincronização.");
    const { syncGhlAppointments } = await import("@/lib/sync.server");
    return syncGhlAppointments();
  });

export interface SyncFailureRow {
  id: string;
  ghl_event_id: string | null;
  reason: string;
  /** JSON-stringified payload (or null). Server fn pre-serializes for safe transport. */
  payload: string | null;
  created_at: string;
}

export const listOpenSyncFailures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SyncFailureRow[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("ghl_sync_failures" as never)
      .select("id, ghl_event_id, reason, payload, created_at")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    type Raw = {
      id: string;
      ghl_event_id: string | null;
      reason: string;
      payload: unknown;
      created_at: string;
    };
    return ((data ?? []) as Raw[]).map<SyncFailureRow>((r) => ({
      id: r.id,
      ghl_event_id: r.ghl_event_id,
      reason: r.reason,
      payload: r.payload == null ? null : JSON.stringify(r.payload),
      created_at: r.created_at,
    }));
  });

export const resolveSyncFailure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as { id?: string };
    if (!d?.id || typeof d.id !== "string") throw new Error("id requerido");
    return { id: d.id };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ghl_sync_failures" as never)
      .update({ resolved_at: new Date().toISOString(), resolved_by: userId } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });