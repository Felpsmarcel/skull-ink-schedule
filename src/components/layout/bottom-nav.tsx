import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CalendarDays, Home, Plus, User as UserIcon, Wallet } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { Button } from "@/components/ui/button";

export function BottomNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <nav aria-label="Navegação principal" data-bottom-nav className="fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-md grid-cols-5 items-end gap-1 border-t border-border/80 bg-background/92 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-12px_30px_color-mix(in_oklab,var(--background)_70%,transparent)] backdrop-blur-xl sm:hidden">
      <NavLink to="/home" icon={<Home className="h-5 w-5" />} label="Hoje" />
      <NavLink to="/agenda" icon={<CalendarDays className="h-5 w-5" />} label={t("nav.agenda")} />
      <Button
        type="button"
        size="icon"
        onClick={() => {
          haptic("tap");
          navigate({ to: "/appointments/new" });
        }}
        aria-label={t("nav.new")}
        className="-mt-7 grid h-14 w-14 place-self-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_color-mix(in_oklab,var(--primary)_30%,transparent)] ring-4 ring-background transition-transform duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-primary"
      >
        <Plus className="h-7 w-7" />
      </Button>
      <NavLink to="/financeiro" icon={<Wallet className="h-5 w-5" />} label={t("nav.financeiro", { defaultValue: "Financeiro" })} />
      <NavLink to="/menu" icon={<UserIcon className="h-5 w-5" />} label={t("nav.profile", { defaultValue: "Perfil" })} />
    </nav>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: false }}
      onClick={() => haptic("tap")}
      className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md py-1 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:text-foreground active:bg-muted data-[status=active]:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span aria-hidden="true" className="shrink-0">{icon}</span>
      <span className="max-w-full text-center leading-tight [overflow-wrap:anywhere]">{label}</span>
    </Link>
  );
}