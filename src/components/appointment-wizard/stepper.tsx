import { Link, useRouterState } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS, type WizardStep } from "@/lib/appointment-draft-validate";

export interface StepperProps {
  /** Which steps are already completed (used to allow jumping back). */
  completed: Record<WizardStep, boolean>;
}

const LABELS: Record<WizardStep, string> = {
  cliente: "Cliente",
  agenda: "Agenda",
  servicos: "Serviços",
  revisao: "Revisão",
};

export function WizardStepper({ completed }: StepperProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = currentStep(pathname);
  const currentIdx = WIZARD_STEPS.indexOf(current);

  return (
    <nav
      aria-label="Progresso do agendamento"
      className="border-b border-border bg-card/40 px-3 py-2"
    >
      <ol className="flex items-center gap-1.5">
        {WIZARD_STEPS.map((step, i) => {
          const active = step === current;
          const done = completed[step] && !active;
          const reachable = done || active || i <= currentIdx;
          const cls = cn(
            "flex min-w-0 flex-1 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] uppercase tracking-wider transition",
            active
              ? "border-primary bg-primary/10 text-foreground"
              : done
                ? "border-primary/40 bg-primary/5 text-foreground"
                : "border-border bg-background text-muted-foreground",
          );
          const inner = (
            <>
              <span
                className={cn(
                  "grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-primary/70 text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </span>
              <span className="truncate">{LABELS[step]}</span>
            </>
          );
          return (
            <li key={step} className="min-w-0 flex-1">
              {reachable ? (
                <Link to={`/appointments/new/${step}`} className={cls}>
                  {inner}
                </Link>
              ) : (
                <span className={cn(cls, "cursor-not-allowed opacity-60")}>{inner}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function currentStep(pathname: string): WizardStep {
  const match = WIZARD_STEPS.find((s) => pathname.includes(`/appointments/new/${s}`));
  return match ?? "cliente";
}