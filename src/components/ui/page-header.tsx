import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  leading,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border/80 bg-background/90 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-xl sm:px-6 sm:pt-5",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="mb-1 text-xs font-semibold uppercase text-primary">{eyebrow}</p>
          ) : null}
          <h1 className="truncate font-display text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}
