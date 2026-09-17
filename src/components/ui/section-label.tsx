import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionLabel({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex min-h-6 items-center justify-between gap-3", className)}>
      <h2 className="font-display text-xs font-bold uppercase text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}
