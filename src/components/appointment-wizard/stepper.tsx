import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS, type WizardStep } from "@/lib/appointment-draft-validate";

const STEP_PATH = {
  cliente: "/appointments/new/cliente",
  projeto: "/appointments/new/projeto",
  agenda: "/appointments/new/agenda",
  servicos: "/appointments/new/servicos",
  revisao: "/appointments/new/revisao",
} as const;

export interface StepperProps {
  /** Which steps are already completed (used to allow jumping back). */
  completed: Record<WizardStep, boolean>;
}

const LABELS: Record<WizardStep, string> = {
  cliente: "Cliente",
  projeto: "Projeto",
  agenda: "Agenda",
  servicos: "Serviços",
  revisao: "Revisão",
};

export function WizardStepper({ completed }: StepperProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = currentStep(pathname);
  return (
    <WizardStepperView
      current={current}
      completed={completed}
      renderLink={(step, content, className, active) => (
        <Link to={STEP_PATH[step]} className={className} aria-current={active ? "step" : undefined}>
          {content}
        </Link>
      )}
    />
  );
}

export function WizardStepperView({
  current,
  completed,
  renderLink,
}: StepperProps & {
  current: WizardStep;
  renderLink: (
    step: WizardStep,
    content: ReactNode,
    className: string,
    active: boolean,
  ) => ReactNode;
}) {
  const currentIdx = WIZARD_STEPS.indexOf(current);

  return (
    <nav
      aria-label="Progresso do agendamento"
      className="border-b border-border bg-card/60 px-3 py-3 sm:px-6"
    >
      <ol className="mx-auto grid w-full max-w-4xl grid-cols-5 gap-1 sm:gap-3">
        {WIZARD_STEPS.map((step, i) => {
          const active = step === current;
          const done = completed[step] && !active;
          const reachable = done || active || i <= currentIdx;
          const cls = cn(
            "flex min-h-16 min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2 text-[11px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-12 sm:flex-row sm:gap-2 sm:px-3 sm:text-xs",
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
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-primary/70 text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {done ? (
                  <Check aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <span aria-hidden="true">{i + 1}</span>
                )}
              </span>
              <span className="break-words text-center">{LABELS[step]}</span>
              {done ? <span className="sr-only">, preenchido</span> : null}
            </>
          );
          return (
            <li key={step} className="min-w-0 flex-1">
              {reachable ? (
                renderLink(step, inner, cls, active)
              ) : (
                <span aria-disabled="true" className={cn(cls, "text-muted-foreground")}>
                  {inner}
                </span>
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
