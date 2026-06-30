import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const variantClasses: Record<StatusVariant, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
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
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
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