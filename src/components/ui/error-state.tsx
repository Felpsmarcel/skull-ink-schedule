import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  description?: string;
  details?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

export function ErrorState({
  title,
  description,
  details,
  onRetry,
  retryLabel,
  className,
}: Props) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("error.title", { defaultValue: "Algo deu errado" });
  const resolvedRetry = retryLabel ?? t("error.retry", { defaultValue: "Tentar novamente" });
  const detailsLabel = t("error.details", { defaultValue: "Detalhes técnicos" });

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-8 text-center",
        className,
      )}
    >
      <div className="grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{resolvedTitle}</p>
      {description ? (
        <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      ) : null}
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-1">
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          {resolvedRetry}
        </Button>
      ) : null}
      {details ? (
        <details className="mt-2 w-full max-w-md text-left">
          <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
            {detailsLabel}
          </summary>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/50 p-2 text-[10px] text-muted-foreground">
            {details}
          </pre>
        </details>
      ) : null}
    </div>
  );
}