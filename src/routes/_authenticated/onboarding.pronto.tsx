import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, Loader2, Plus, Wallet } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { completeOnboarding } from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/onboarding/pronto")({
  head: () => ({ meta: [{ title: "Tudo pronto — GF Tattoo Studio" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ReadyStep,
});

type Dest = "/agenda" | "/appointments/new" | "/financeiro";

function ReadyStep() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const complete = useServerFn(completeOnboarding);
  const mutation = useMutation({
    mutationFn: async (dest: Dest) => {
      await complete();
      return dest;
    },
    onSuccess: async (dest) => {
      await qc.invalidateQueries({ queryKey: ["onboarding-status"] });
      navigate({ to: dest });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = mutation.isPending;

  return (
    <div className="space-y-6">
      <Toaster position="top-center" />
      <div>
        <h1 className="text-2xl font-bold">Tudo pronto</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seu perfil está configurado. Por onde você quer começar?
        </p>
      </div>

      <div className="space-y-3">
        <ActionCard
          disabled={pending}
          onClick={() => mutation.mutate("/agenda")}
          icon={<CalendarDays className="h-5 w-5" />}
          title="Ver minha agenda"
          desc="Todos os seus atendimentos, dia a dia."
        />
        <ActionCard
          disabled={pending}
          onClick={() => mutation.mutate("/appointments/new")}
          icon={<Plus className="h-5 w-5" />}
          title="Criar meu primeiro agendamento"
          desc="Registre um cliente e um serviço em segundos."
        />
        <ActionCard
          disabled={pending}
          onClick={() => mutation.mutate("/financeiro")}
          icon={<Wallet className="h-5 w-5" />}
          title="Ver meu financeiro"
          desc="Suas comissões e recebimentos."
        />
      </div>

      {pending ? (
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
        </p>
      ) : null}
    </div>
  );
}

function ActionCard(props: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition hover:border-foreground/40 disabled:opacity-60"
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-muted">{props.icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-semibold">{props.title}</span>
        <span className="block text-xs text-muted-foreground">{props.desc}</span>
      </span>
    </button>
  );
}