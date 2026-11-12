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
        "sticky top-0 sm:top-[var(--gf-chrome-offset,0px)] z-30 border-b border-border/80 bg-background/90 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-xl sm:px-6 sm:pt-5",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-[min(12rem,100%)] flex-1">
          {eyebrow ? (
            <p className="mb-1 text-xs font-semibold uppercase text-primary">{eyebrow}</p>
          ) : null}
          <h1 className="break-words font-display text-xl font-bold text-foreground sm:text-2xl">
            {title}
          </h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
