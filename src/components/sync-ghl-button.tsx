import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { runGhlSync, type SyncResult } from "@/lib/sync.functions";

type ButtonProps = React.ComponentProps<typeof Button>;

interface Props {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  children?: ReactNode;
  onSettled?: (result: SyncResult | null, error: Error | null) => void;
}

function friendlyMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("unauthorized") || m.includes("no authorization"))
    return "Sessão expirada. Faça login novamente.";
  if (m.includes("ghl_token") || m.includes("token ausente"))
    return "Token do GHL não configurado no servidor.";
  if (m.includes("apenas administradores"))
    return "Apenas administradores podem rodar a sincronização.";
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("timeout"))
    return "Sem conexão com o servidor. Verifique a rede e tente novamente.";
  return "Não foi possível sincronizar agora. Tente novamente em instantes.";
}

function summary(r: SyncResult): string {
  return (
    `${r.scannedCalendars} calendários · ${r.fetchedEvents} eventos · ` +
    `${r.inserted} novos · ${r.updated} atualizados · ${r.failures} falhas`
  );
}

export function SyncGhlButton({
  variant = "outline",
  size = "sm",
  className,
  children,
  onSettled,
}: Props) {
  const qc = useQueryClient();
  const sync = useServerFn(runGhlSync);

  const syncM = useMutation<SyncResult, Error>({
    mutationFn: () => sync(),
    onSuccess: (r) => {
      const desc = summary(r);
      if (r.failures > 0) {
        toast.warning("Sincronização concluída com falhas", { description: desc });
      } else {
        toast.success("Sincronização concluída", { description: desc });
      }
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      qc.invalidateQueries({ queryKey: ["sync-failures"] });
      qc.invalidateQueries({ queryKey: ["agenda-status"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      onSettled?.(r, null);
    },
    onError: (e) => {
      const raw = e instanceof Error ? e.message : String(e);
      toast.error("Falha ao sincronizar", {
        description: friendlyMessage(raw),
        action: {
          label: "Copiar erro",
          onClick: () => {
            void navigator.clipboard?.writeText(raw);
          },
        },
      });
      onSettled?.(null, e instanceof Error ? e : new Error(raw));
    },
  });

  const pending = syncM.isPending;
  const idleLabel = children ?? "Sincronizar";

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      onClick={() => {
        if (pending) return;
        syncM.mutate();
      }}
      disabled={pending}
      aria-busy={pending || undefined}
    >
      <RefreshCw className={`mr-2 h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Sincronizando…" : idleLabel}
    </Button>
  );
}