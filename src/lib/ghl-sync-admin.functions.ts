import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: unknown, userId: string) {
  const client = supabase as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null }> };
  const { data: isAdmin } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new Response("Forbidden", { status: 403 });
}

export const getGhlSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("ghl_sync_status" as never);
    if (error) throw new Error(error.message);
    return data as {
      job: { jobname: string; schedule: string; active: boolean } | null;
      runs: Array<{ start_time: string; end_time: string | null; status: string | null; return_message: string | null }>;
      vault_ok: boolean;
    };
  });

export const scheduleGhlSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("schedule_ghl_sync" as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unscheduleGhlSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("unschedule_ghl_sync" as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });