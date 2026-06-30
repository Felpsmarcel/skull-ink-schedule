import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  size?: "sm" | "md";
  inline?: boolean;
  className?: string;
};

export function LoadingState({ label, size = "md", inline = false, className }: Props) {
  const { t } = useTranslation();
  const resolved = label ?? t("loading", { defaultValue: "Carregando…" });
  const iconCls = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const textCls = size === "sm" ? "text-xs" : "text-sm";

  if (inline) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground", textCls, className)}>
        <Loader2 className={cn(iconCls, "animate-spin")} />
        <span>{resolved}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground",
        className,
      )}
    >
      <Loader2 className={cn(iconCls, "animate-spin")} />
      <span className={textCls}>{resolved}</span>
    </div>
  );
}