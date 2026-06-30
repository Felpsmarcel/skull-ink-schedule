import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CalendarDays, Scissors, Plus, Star, Menu as MenuIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type BottomNavTab = "agenda" | "services" | "reviews" | "menu";

export function BottomNav({ active }: { active: BottomNavTab }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-end justify-around border-t border-border bg-background/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
      <NavLink to="/agenda" icon={<CalendarDays className="h-5 w-5" />} label={t("nav.agenda")} active={active === "agenda"} />
      <NavLink to="/services" icon={<Scissors className="h-5 w-5" />} label={t("nav.services")} active={active === "services"} />
      <button
        type="button"
        onClick={() => navigate({ to: "/appointments/new" })}
        aria-label={t("nav.new")}
        className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background"
      >
        <Plus className="h-7 w-7" />
      </button>
      <NavLink to="/reviews" icon={<Star className="h-5 w-5" />} label={t("nav.reviews")} active={active === "reviews"} />
      <NavLink to="/menu" icon={<MenuIcon className="h-5 w-5" />} label={t("nav.menu")} active={active === "menu"} />
    </nav>
  );
}

function NavLink({
  to,
  icon,
  label,
  active,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] uppercase tracking-wider",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}