import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Link2, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  getMovimentacaoLinkStatus,
  type MovimentacaoLinkStatus,
} from "@/lib/movimentacao-links.functions";
import { inviteArtist, repairArtistLink } from "@/lib/team.functions";
import { inviteSeller, repairSellerLink } from "@/lib/sellers-invite.functions";

export const Route = createFileRoute("/_authenticated/_admin/admin/movimentacao-links")({
  head: () => ({
    meta: [
      { title: "Links de pagamento — GF Tattoo Studio" },
      { name: "description", content: "Verifique e convide artistas para os links de registro de pagamento." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MovimentacaoLinksPage,
});

const PROD_ORIGIN = "https://gftattoocalendar.com";

function MovimentacaoLinksPage() {
  const status = useServerFn(getMovimentacaoLinkStatus);
  const q = useQuery({
    queryKey: ["movimentacao-links"],
    queryFn: () => status(),
    staleTime: 30_000,
  });

  const rows = q.data ?? [];
  const readyCount = rows.filter((r) => r.ready).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <Toaster position="top-center" />
      <header className="mb-4">
        <h1 className="text-xl font-bold uppercase tracking-wider">Links de pagamento</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Cada tatuador (e a Nívia) precisa de um usuário vinculado para que o link
          <code className="mx-1 rounded bg-muted px-1">/movimentacao/&lt;slug&gt;</code>
          funcione.
        </p>
        {q.data && (
          <p className="mt-2 text-sm">
            <strong>{readyCount}</strong> de <strong>{rows.length}</strong> links prontos.
          </p>
        )}
      </header>

      {q.isLoading ? (
        <LoadingState label="Verificando vínculos…" />
      ) : q.isError ? (
        <ErrorState
          description={q.error instanceof Error ? q.error.message : "Falha"}
          onRetry={() => { void q.refetch(); }}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <LinkCard key={row.slug} row={row} onRefresh={() => q.refetch()} />
          ))}
        </ul>
      )}
    </div>
  );
}

function statusBadge(row: MovimentacaoLinkStatus) {
  if (!row.exists) return <StatusBadge variant="danger">sem cadastro</StatusBadge>;
  if (!row.active) return <StatusBadge variant="danger">inativo</StatusBadge>;
  if (row.linkedUsers.length === 0) return <StatusBadge variant="warning">sem usuário</StatusBadge>;
  return (
    <StatusBadge variant="success" icon={<CheckCircle2 className="h-3 w-3" />}>
      pronto
    </StatusBadge>
  );
}

function LinkCard({
  row,
  onRefresh,
}: {
  row: MovimentacaoLinkStatus;
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const inviteArtistFn = useServerFn(inviteArtist);
  const repairArtistFn = useServerFn(repairArtistLink);
  const inviteSellerFn = useServerFn(inviteSeller);
  const repairSellerFn = useServerFn(repairSellerLink);

  const [email, setEmail] = useState(row.linkedUsers[0]?.email ?? "");
  const url = `${PROD_ORIGIN}/movimentacao/${row.slug}`;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["movimentacao-links"] });
    qc.invalidateQueries({ queryKey: ["team"] });
    qc.invalidateQueries({ queryKey: ["sellers-with-users"] });
    onRefresh();
  };

  const inviteM = useMutation({
    mutationFn: async () => {
      const trimmed = email.trim();
      if (row.kind === "artist") {
        return inviteArtistFn({ data: { artistId: row.targetId, email: trimmed } });
      }
      return inviteSellerFn({
        data: {
          sellerId: row.targetId,
          email: trimmed,
          redirectTo: `${PROD_ORIGIN}/auth/update-password`,
        },
      });
    },
    onSuccess: (r) => {
      const linkOk = "linkOk" in r ? r.linkOk : true;
      const reused = "reused" in r ? r.reused : false;
      if (!linkOk) {
        toast.error(`Convite enviado mas vínculo falhou. Use "Reparar vínculo".`);
      } else {
        toast.success(
          reused
            ? "Novo link de acesso enviado."
            : "Convite enviado. Peça para checar a caixa de entrada.",
        );
      }
      invalidate();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Falha ao convidar";
      if (msg.toLowerCase().includes("already registered")) {
        toast.error('Usuário já existe. Use "Reparar vínculo".');
      } else {
        toast.error(msg);
      }
    },
  });

  const repairM = useMutation({
    mutationFn: async () => {
      const trimmed = email.trim();
      if (row.kind === "artist") {
        return repairArtistFn({ data: { artistId: row.targetId, email: trimmed } });
      }
      return repairSellerFn({ data: { sellerId: row.targetId, email: trimmed } });
    },
    onSuccess: () => {
      toast.success("Vínculo reparado.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao reparar"),
  });

  const canInvite = row.exists && row.active;
  const linkedEmails = row.linkedUsers.map((u) => u.email ?? u.id.slice(0, 8));

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{row.displayName}</p>
            {statusBadge(row)}
            <StatusBadge variant="neutral">{row.kind === "artist" ? "tatuador" : "vendedor"}</StatusBadge>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <code className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px]">{url}</code>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success("Link copiado.");
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          {linkedEmails.length > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Vinculado: {linkedEmails.join(", ")}
            </p>
          )}
        </div>
      </div>

      {!row.exists ? (
        <p className="mt-3 rounded border border-dashed border-border p-3 text-[11px] text-muted-foreground">
          Registro não encontrado. Verifique o id em <code>movimentacao-slugs.ts</code>.
        </p>
      ) : !row.active ? (
        <p className="mt-3 rounded border border-dashed border-border p-3 text-[11px] text-muted-foreground">
          {row.kind === "artist" ? "Tatuador" : "Vendedor"} inativo — ative em{" "}
          {row.kind === "artist" ? "Equipe" : "Vendedores"} antes de convidar.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            autoComplete="email"
            placeholder="email@dominio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="sm:max-w-xs"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (!email.trim()) { toast.error("Informe o email."); return; }
                inviteM.mutate();
              }}
              disabled={!canInvite || inviteM.isPending}
            >
              {inviteM.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-2 h-3.5 w-3.5" />
              )}
              {row.linkedUsers.length > 0 ? "Reenviar convite" : "Convidar"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!email.trim()) { toast.error("Informe o email."); return; }
                repairM.mutate();
              }}
              disabled={!canInvite || repairM.isPending}
            >
              {repairM.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-3.5 w-3.5" />
              )}
              Reparar
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}