import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, LogOut, Wallet, RefreshCw, Wrench, Bell, Languages } from "lucide-react";
import { toast } from "sonner";
import "@/i18n";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated/menu")({
  head: () => ({ meta: [{ title: "Menu — GF Tattoo Studio" }] }),
  component: MenuPage,
});

function MenuPage() {
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdmin = me?.role === "admin";
  const roleLabel = me?.role === "admin" ? "Admin" : me?.role === "artist" ? "Tatuador" : "—";
  const initials = (me?.email ?? "?").slice(0, 2).toUpperCase();

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-svh bg-background pb-24 text-foreground">
      <Toaster position="top-center" />
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <h1 className="text-base font-bold uppercase tracking-wider">Menu</h1>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-sm font-bold">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{me?.email ?? "—"}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{roleLabel}</p>
          </div>
        </div>

        <Section title="Conta">
          <Row to="/financeiro" icon={<Wallet className="h-4 w-4" />} label="Meu financeiro" />
          {isAdmin && (
            <>
              <Row to="/reconciliar" icon={<RefreshCw className="h-4 w-4" />} label="Reconciliar GHL" />
              <Row to="/ghl-test" icon={<Wrench className="h-4 w-4" />} label="Testar GHL" />
            </>
          )}
        </Section>

        <Section title="Preferências">
          <DisabledRow icon={<Bell className="h-4 w-4" />} label="Notificações" />
          <DisabledRow icon={<Languages className="h-4 w-4" />} label="Idioma" />
        </Section>

        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-muted"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>

      <BottomNav active="menu" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {children}
      </ul>
    </div>
  );
}

function Row({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted">
        <span className="text-muted-foreground">{icon}</span>
        <span className="flex-1">{label}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </li>
  );
}

function DisabledRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => toast("Em breve")}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-muted-foreground hover:bg-muted"
      >
        <span>{icon}</span>
        <span className="flex-1">{label}</span>
        <span className="text-[10px] uppercase tracking-wider">Em breve</span>
      </button>
    </li>
  );
}