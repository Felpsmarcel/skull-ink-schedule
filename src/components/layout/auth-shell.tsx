import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  Home,
  LogOut,
  Plus,
  User as UserIcon,
  Wallet,
  AlertTriangle,
  Layers3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import gfMark from "@/assets/gf-mark.png";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Button } from "@/components/ui/button";

const HIDE_CHROME_PREFIXES = ["/appointments/new"];

export function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideChrome = HIDE_CHROME_PREFIXES.some((p) => pathname.startsWith(p));

  if (hideChrome) return <>{children}</>;

  return (
    <div className="flex min-h-svh flex-col bg-background [--gf-chrome-offset:0px] sm:[--gf-chrome-offset:7.5rem] xl:[--gf-chrome-offset:4.5rem]">
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
    navigate({ to: "/auth", search: { redirect: undefined }, replace: true });
  }

  return (
    <header className="sticky top-0 z-40 hidden h-30 grid-cols-[1fr_auto] items-center gap-x-4 border-b border-border/80 bg-background/95 px-5 backdrop-blur-xl sm:grid xl:h-18 xl:grid-cols-[auto_1fr_auto] xl:gap-6 xl:px-8">
      <Link
        to="/home"
        className="flex w-fit items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img src={gfMark} alt="" className="h-7 w-7 object-contain" />
        <span className="font-display text-sm font-bold uppercase">GF / Tattoo</span>
      </Link>
      <nav
        aria-label="Navegação principal"
        className="col-span-2 row-start-2 flex min-w-0 items-center justify-center gap-1 self-start rounded-xl border border-border bg-card p-1 shadow-sm xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:w-fit xl:justify-self-center xl:self-center"
      >
        <TopLink to="/home" icon={<Home className="h-4 w-4" />} label="Hoje" />
        <TopLink to="/agenda" icon={<CalendarDays className="h-4 w-4" />} label={t("nav.agenda")} />
        <TopLink to="/projetos" icon={<Layers3 className="h-4 w-4" />} label="Projetos" />
        <TopLink to="/appointments/new" icon={<Plus className="h-4 w-4" />} label={t("nav.new")} />
        <TopLink
          to="/financeiro"
          icon={<Wallet className="h-4 w-4" />}
          label={t("nav.financeiro", { defaultValue: "Financeiro" })}
        />
        <TopLink
          to="/menu"
          icon={<UserIcon className="h-4 w-4" />}
          label={t("nav.profile", { defaultValue: "Perfil" })}
        />
        {isAdmin ? (
          <TopLink
            to="/reconciliar"
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Reconciliar"
          />
        ) : null}
      </nav>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        className="col-start-2 row-start-1 ml-auto flex min-h-11 xl:col-start-3 items-center gap-2 rounded-md px-3 text-xs font-semibold uppercase text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </Button>
    </header>
  );
}

function TopLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: false }}
      className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-1.5 md:px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {icon}
      {label}
    </Link>
  );
}

export { cn };
