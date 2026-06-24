import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "admin" | "artist";

export interface MyProfile {
  userId: string;
  email: string | null;
  role: AppRole | null;
  artistId: string | null;
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const { supabase, userId, claims } = context;
    const { data, error } = await supabase
      .from("app_users" as never)
      .select("role, artist_id")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = (data ?? null) as { role: AppRole | null; artist_id: string | null } | null;
    return {
      userId,
      email: (claims as { email?: string | null }).email ?? null,
      role: row?.role ?? null,
      artistId: row?.artist_id ?? null,
    };
  });

export const requireAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.rpc("has_role" as never, {
      _user_id: userId,
      _role: "admin",
    } as never);
    if (error) throw new Error(error.message);
    if (!data) throw redirect({ to: "/agenda" });
    return { ok: true as const };
  });