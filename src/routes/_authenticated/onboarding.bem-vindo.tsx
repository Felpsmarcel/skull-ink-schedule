import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/onboarding/bem-vindo")({
  head: () => ({ meta: [{ title: "Bem-vindo — GF Tattoo Studio" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: WelcomeStep,
});

function WelcomeStep() {
  const { data: me } = useCurrentUser();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Bem-vindo(a) à GF Tattoo{me?.email ? "," : ""}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua conta está pronta. Em cerca de 2 minutos você configura seu perfil, seus horários de
          atendimento e os serviços que executa.
        </p>
      </div>
      <ul className="space-y-3 text-sm">
        <li className="rounded-lg border border-border bg-card p-3">
          <strong className="block text-xs uppercase tracking-wider">Sua agenda</strong>
          <span className="text-muted-foreground">Veja todos os agendamentos num só lugar.</span>
        </li>
        <li className="rounded-lg border border-border bg-card p-3">
          <strong className="block text-xs uppercase tracking-wider">Comissões</strong>
          <span className="text-muted-foreground">Acompanhe o financeiro dos seus atendimentos.</span>
        </li>
        <li className="rounded-lg border border-border bg-card p-3">
          <strong className="block text-xs uppercase tracking-wider">Lembretes automáticos</strong>
          <span className="text-muted-foreground">Seus clientes recebem confirmações por email.</span>
        </li>
      </ul>
      <Button asChild className="w-full">
        <Link to="/onboarding/perfil">Começar</Link>
      </Button>
    </div>
  );
}