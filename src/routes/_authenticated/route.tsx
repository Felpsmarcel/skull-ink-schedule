import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/layout/auth-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    // Onboarding gate for artists: if the artist has not completed the initial
    // setup, force them to /onboarding — except when they're already there or
    // in the account menu.
    const path = location.pathname;
    const inOnboarding = path.startsWith("/onboarding");
    const inMenu = path === "/menu";
    const inAdmin = path.startsWith("/admin");
    if (!inOnboarding && !inMenu && !inAdmin) {
      const { data: appUser } = await supabase
        .from("app_users")
        .select("role, artist_id")
        .eq("id", data.user.id)
        .maybeSingle();
      const row = appUser as { role: string | null; artist_id: string | null } | null;
      if (row?.role === "artist" && row.artist_id) {
        const { data: artist } = await supabase
          .from("artists")
          .select("onboarded_at")
          .eq("id", row.artist_id)
          .maybeSingle();
        const onboardedAt = (artist as { onboarded_at: string | null } | null)?.onboarded_at ?? null;
        if (!onboardedAt) {
          throw redirect({ to: "/onboarding/bem-vindo" });
        }
      }
    }
    return { user: data.user };
  },
  component: () => (
    <AuthShell>
      <Outlet />
    </AuthShell>
  ),
});