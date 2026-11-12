import type { ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WizardFooterProps {
  /** Whether to show the back button (uses browser history). */
  showBack?: boolean;
  primary: ReactNode;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
}

export function WizardFooter({
  showBack,
  primary,
  onPrimary,
  primaryDisabled,
  primaryLoading,
}: WizardFooterProps) {
  const router = useRouter();
  return (
    <WizardFooterView
      primary={primary}
      onPrimary={onPrimary}
      primaryDisabled={primaryDisabled}
      primaryLoading={primaryLoading}
      onBack={showBack ? () => router.history.back() : undefined}
    />
  );
}

export function WizardFooterView({
  primary,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  onBack,
}: Omit<WizardFooterProps, "showBack"> & { onBack?: () => void }) {
  return (
    <footer
      aria-label="Ações do agendamento"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pt-3 shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.18)] backdrop-blur sm:px-6"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex w-full max-w-4xl items-center gap-3">
        {onBack ? (
          <Button
            type="button"
            variant="outline"
            className="h-12 shrink-0 gap-2 px-4"
            onClick={onBack}
            aria-label="Voltar"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
        ) : null}
        <Button
          type="button"
          className="ml-auto min-h-12 h-auto flex-1 whitespace-normal px-4 py-3 text-sm sm:max-w-sm"
          onClick={onPrimary}
          disabled={primaryDisabled || primaryLoading}
          aria-busy={primaryLoading || undefined}
        >
          {primary}
        </Button>
      </div>
    </footer>
  );
}
