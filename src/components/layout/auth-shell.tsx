import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, LogOut, Plus, User as UserIcon, Wallet, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import gfMark from "@/assets/gf-mark.png";
import { BottomNav } from "@/components/layout/bottom-nav";

const HIDE_CHROME_PREFIXES = ["/appointments/new"];

export function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideChrome = HIDE_CHROME_PREFIXES.some((p) => pathname.startsWith(p));

  if (hideChrome) return <>{children}</>;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <TopBar />
      <div key={pathname} data-route-fade className="flex-1">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}

function TopBar() {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 hidden h-14 items-center justify-between gap-4 border-b border-border bg-background/95 px-6 backdrop-blur sm:flex">
      <Link to="/agenda" className="flex items-center gap-2">
        <img src={gfMark} alt="" className="h-7 w-7 object-contain" />
        <span className="font-display text-sm uppercase tracking-[0.2em]">GF Tattoo</span>
      </Link>
      <nav className="flex items-center gap-1">
        <TopLink to="/agenda" icon={<CalendarDays className="h-4 w-4" />} label={t("nav.agenda")} />
        <TopLink to="/appointments/new" icon={<Plus className="h-4 w-4" />} label={t("nav.new")} />
        <TopLink to="/financeiro" icon={<Wallet className="h-4 w-4" />} label={t("nav.financeiro", { defaultValue: "Financeiro" })} />
        <TopLink to="/menu" icon={<UserIcon className="h-4 w-4" />} label={t("nav.profile", { defaultValue: "Perfil" })} />
        {isAdmin ? (
          <TopLink
            to="/reconciliar"
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Reconciliar"
          />
        ) : null}
      </nav>
      <button
        type="button"
        onClick={handleSignOut}
        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </header>
  );
}

function TopLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: false }}
      className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:bg-muted hover:text-foreground data-[status=active]:bg-muted data-[status=active]:text-foreground"
    >
      {icon}
      {label}
    </Link>
  );
}

export { cn };