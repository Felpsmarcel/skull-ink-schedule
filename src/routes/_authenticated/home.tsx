import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Banknote, CalendarDays, Link2Off, QrCode, Users, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVinculosIncompletos } from "@/lib/projects.functions";
import { FilaAguardando, useFilaHoje } from "@/components/checkin/fila-aguardando";
import { useCurrentUser } from "@/hooks/use-current-user";
import gfMark from "@/assets/gf-mark.png";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Central operacional — GF Tattoo Studio" },
      {
        name: "description",
        content: "Fila de clientes, agenda do dia e atalhos do GF Tattoo Studio.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === "admin";
  const { data: fila } = useFilaHoje();
  const aguardando = (fila ?? []).filter((r) => r.status === "aguardando").length;
  const emAtendimento = (fila ?? []).filter((r) => r.status === "em_atendimento").length;
  const fetchVinculos = useServerFn(getVinculosIncompletos);
  const vinculosQ = useQuery({
    queryKey: ["vinculos-incompletos"],
    queryFn: () => fetchVinculos(),
    enabled: isAdmin,
    staleTime: 5 * 60_000,
    retry: false,
  });

  return (
    <div className="min-h-svh bg-background pb-[calc(env(safe-area-inset-bottom)+7rem)] text-foreground sm:pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <img src={gfMark} alt="" className="h-7 w-7 object-contain" />
        <h1 className="flex-1 text-base font-bold uppercase tracking-wider">Hoje</h1>
      </header>

      <div className="mx-auto max-w-md space-y-5 px-4 py-4 sm:max-w-3xl">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Aguardando" value={aguardando} />
          <Stat label="Em atendimento" value={emAtendimento} />
        </div>

        {isAdmin && vinculosQ.data ? (
          <Link
            to="/relatorios/movimentacoes"
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
          >
            <Link2Off className="h-5 w-5 text-amber-500" />
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Vínculos incompletos
              </p>
              <p className="text-xs text-muted-foreground">
                {vinculosQ.data.appointmentsSemProjeto} agendamentos ·{" "}
                {vinculosQ.data.movimentacoesSemVinculo} pagamentos
              </p>
            </div>
            <span className="text-3xl font-bold">{vinculosQ.data.total}</span>
          </Link>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <BigAction to="/agenda" icon={<CalendarDays className="h-5 w-5" />} label="Agenda" />
          <BigAction to="/totem" icon={<QrCode className="h-5 w-5" />} label="Check-in" />
        </div>

        <section>
          <h2 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Clientes aguardando
          </h2>
          <FilaAguardando />
        </section>

        <section>
          <h2 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Atalhos
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Shortcut to="/financeiro" icon={<Wallet className="h-4 w-4" />} label="Financeiro" />
            <Shortcut
              to="/movimentacao"
              icon={<Banknote className="h-4 w-4" />}
              label="Registrar pagamento"
            />
            <Shortcut
              to="/relatorios/movimentacoes"
              icon={<BarChart3 className="h-4 w-4" />}
              label="Relatório"
            />
            {isAdmin ? (
              <Shortcut to="/admin/fila" icon={<Users className="h-4 w-4" />} label="Fila do dia" />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}

function BigAction({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-20 flex-col justify-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground active:scale-[0.98]"
    >
      {icon}
      <span className="text-sm font-bold uppercase tracking-wider">{label}</span>
    </Link>
  );
}

function Shortcut({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-16 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">{label}</span>
    </Link>
  );
}
