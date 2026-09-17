import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const variantClasses: Record<StatusVariant, string> = {
  success: "bg-success/10 text-success border-success/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  danger: "bg-destructive/10 text-destructive border-destructive/30",
  info: "bg-info/10 text-info border-info/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusVariant;
  icon?: React.ReactNode;
}

export function StatusBadge({
  variant = "neutral",
  icon,
  className,
  children,
  ...rest
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-xs font-semibold uppercase",
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}

export type PaymentBucketLike = "pago" | "pendente" | "a_receber";

export function bucketToVariant(b: PaymentBucketLike): StatusVariant {
  if (b === "pago") return "success";
  if (b === "pendente") return "warning";
  return "info";
}

export function bucketLabel(b: PaymentBucketLike): string {
  if (b === "pago") return "Pago";
  if (b === "pendente") return "Pendente";
  return "A receber";
}