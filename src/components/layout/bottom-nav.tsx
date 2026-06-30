import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CalendarDays, Plus, User as UserIcon, Wallet } from "lucide-react";

export function BottomNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-end justify-around border-t border-border bg-background/95 px-6 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
      <NavLink to="/agenda" icon={<CalendarDays className="h-5 w-5" />} label={t("nav.agenda")} />
      <NavLink to="/financeiro" icon={<Wallet className="h-5 w-5" />} label={t("nav.financeiro", { defaultValue: "Financeiro" })} />
      <button
        type="button"
        onClick={() => navigate({ to: "/appointments/new" })}
        aria-label={t("nav.new")}
        className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background"
      >
        <Plus className="h-7 w-7" />
      </button>
      <NavLink to="/menu" icon={<UserIcon className="h-5 w-5" />} label={t("nav.profile", { defaultValue: "Perfil" })} />
    </nav>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: false }}
      className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground data-[status=active]:text-primary"
    >
      {icon}
      {label}
    </Link>
  );
}