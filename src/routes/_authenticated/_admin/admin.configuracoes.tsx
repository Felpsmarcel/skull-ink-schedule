import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { confirmReceipt, getPaymentMirrorStatus } from "@/lib/payment-mirror.functions";

export const Route = createFileRoute("/_authenticated/_admin/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — GF Tattoo Studio" },
      { name: "description", content: "Integrações e pendências administrativas do estúdio." },
      { property: "og:title", content: "Configurações — GF Tattoo Studio" },
      { property: "og:description", content: "Integrações e pendências administrativas do estúdio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Configuracoes,
});

const GATE_LABEL: Record<string, string> = {
  flag: "Interruptor do servidor",
  scopesVerified: "Permissões do token do CRM (faturas e pagamentos) comprovadas",
  contractVerified: "Formato de envio homologado (teste EUR 1,23)",
  workflowsReviewed: "Automações 'Payment Received' conferidas",
  draftHomologated: "Pagamento em fatura não enviada homologado",
};
const SOURCE_LABEL = { payment: "Pagamento da agenda", booking_deposit: "Sinal da reserva", movimentacao: "Movimentação" } as const;
type Src = keyof typeof SOURCE_LABEL;

function Configuracoes() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getPaymentMirrorStatus);
  const confirmFn = useServerFn(confirmReceipt);
  const q = useQuery({ queryKey: ["payment-mirror-status"], queryFn: () => fetchStatus() });
  const [source, setSource] = useState<Src>("payment");
  const [sourceId, setSourceId] = useState("");
  const m = useMutation({
    mutationFn: () => confirmFn({ data: { source, sourceId: sourceId.trim() } }),
    onSuccess: (r) => {
      if (r.ok) { toast.success("Recebimento confirmado e enfileirado."); setSourceId(""); qc.invalidateQueries({ queryKey: ["payment-mirror-status"] }); }
      else toast.error(`Não confirmado: ${r.reason}`);
    },
    onError: () => toast.error("Falha ao confirmar."),
  });
  const active = q.data?.state === "ativo";

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <Link to="/menu" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>
      <h1 className="text-2xl font-semibold">Configurações</h1>
      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">Recebimentos nas faturas do CRM</h2>
          {q.data && <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{active ? "Ativo" : "Em preparação"}</span>}
        </div>
        {q.isLoading && <Skeleton className="h-24 w-full" />}
        {q.isError && <ErrorState title="Não foi possível carregar" description="Tente novamente." onRetry={() => q.refetch()} />}
        {q.data && (
          <>
            <p className="text-sm text-muted-foreground">Uma fatura por projeto, sem envio ao cliente. Cada recebimento confirmado pelo admin registra só a parcela recebida.</p>
            <ul className="space-y-1 text-sm">
              {Object.entries(q.data.gates).map(([k, v]) => (
                <li key={k} className="flex justify-between gap-2"><span>{GATE_LABEL[k]}</span><span className={v ? "text-primary" : "text-muted-foreground"}>{v ? "OK" : "Pendente"}</span></li>
              ))}
            </ul>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Pendências</h3>
              {!active && <p className="text-sm text-muted-foreground">Disponível depois da ativação.</p>}
              {active && q.data.pendingReasons.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pendência.</p>}
              {active && q.data.pendingReasons.length > 0 && (
                <ul className="text-sm">{q.data.pendingReasons.map((p) => <li key={`${p.state}-${p.reason}`} className="flex justify-between gap-2"><span>{p.state} · {p.reason || "—"}</span><span>{p.count}</span></li>)}</ul>
              )}
            </div>

            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (active) m.mutate(); }}>
              <h3 className="text-sm font-medium">Confirmar recebimento</h3>
              {!active && <p className="text-sm text-muted-foreground">Bloqueado: a integração ainda está em preparação (mudança no banco não aplicada e permissões do CRM não comprovadas).</p>}
              <fieldset disabled={!active || m.isPending} className="flex flex-col gap-2 sm:flex-row">
                <select value={source} onChange={(e) => setSource(e.target.value as Src)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  {Object.entries(SOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <input value={sourceId} onChange={(e) => setSourceId(e.target.value)} placeholder="ID do lançamento" className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" />
                <Button type="submit" disabled={!active || !sourceId.trim()}>Confirmar</Button>
              </fieldset>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
