import type { ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <footer
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center gap-2 border-t border-border bg-background/95 px-3 pt-3 backdrop-blur",
        "pb-[max(0.5rem,env(safe-area-inset-bottom))]",
      )}
    >
      {showBack ? (
        <Button
          variant="outline"
          className="h-11 shrink-0"
          onClick={() => router.history.back()}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      ) : null}
      <Button
        className="h-11 flex-1"
        onClick={onPrimary}
        disabled={primaryDisabled || primaryLoading}
      >
        {primary}
      </Button>
    </footer>
  );
}