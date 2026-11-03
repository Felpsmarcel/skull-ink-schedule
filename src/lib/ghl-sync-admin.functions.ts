import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("app_users" as never)
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const role = (data as { role?: string } | null)?.role;
  if (role !== "admin") throw new Error("Forbidden");
}

export const getGhlSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("ghl_sync_status" as never);
    if (error) throw new Error(error.message);
    return data as {
      job: { jobname: string; schedule: string; active: boolean } | null;
      runs: Array<{
        start_time: string;
        end_time: string | null;
        status: string | null;
        return_message: string | null;
      }>;
      vault_ok: boolean;
      last_success_at: string | null;
      latest_status: string | null;
    };
  });

export const scheduleGhlSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("schedule_ghl_sync" as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unscheduleGhlSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("unschedule_ghl_sync" as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const backfillGhlContactNames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { backfillContactNames } = await import("@/lib/sync.server");
    return await backfillContactNames(500);
  });
