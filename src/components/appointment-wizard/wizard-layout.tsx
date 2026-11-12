import type { ReactNode } from "react";
import { Building2, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

/** Presentation only: the route owns draft state and all remote actions. */
export function WizardFrame({
  title,
  backLink,
  progress,
  children,
}: {
  title: string;
  backLink: ReactNode;
  progress: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="wizard-scope flex min-h-dvh flex-col bg-background pb-[calc(env(safe-area-inset-bottom)+7rem)] [--gf-chrome-offset:0px]">
      <PageHeader
        eyebrow="Agendamento guiado"
        title={title}
        leading={backLink}
        description="Cliente, projeto e sessões em um só fluxo."
      />
      {progress}
      {children}
    </div>
  );
}

export function WizardStepMain({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-6 sm:px-6 sm:py-8",
        className,
      )}
    >
      <div className="space-y-1.5">
        <h2 className="font-editorial text-2xl font-semibold text-foreground sm:text-3xl">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </main>
  );
}

export function WizardSection({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      {title ? <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3> : null}
      {description ? (
        <p className="mb-4 text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </section>
  );
}

export function WizardOptionCard({
  active,
  onClick,
  title,
  subtitle,
  right,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  right?: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-16 w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-4 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full",
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {active ? <Check className="h-4 w-4" /> : (icon ?? <Building2 className="h-4 w-4" />)}
      </span>
      <span className="min-w-0 flex-1 basis-36">
        <span className="block break-words text-sm font-semibold">{title}</span>
        {subtitle ? (
          <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
      {right ? (
        <span className="ml-auto break-words text-sm font-semibold tabular-nums">{right}</span>
      ) : null}
    </button>
  );
}
