import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { getPaymentMirrorStatus } from "@/lib/payment-mirror.functions";

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
  scopesVerified: "Permissões do token do CRM comprovadas",
  contractVerified: "Formato de envio homologado (teste EUR 1,23)",
  workflowsReviewed: "Automações 'Payment Received' conferidas",
};

function Configuracoes() {
  const fetchStatus = useServerFn(getPaymentMirrorStatus);
  const q = useQuery({ queryKey: ["payment-mirror-status"], queryFn: () => fetchStatus() });
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <Link to="/home" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>
      <h1 className="text-2xl font-semibold">Configurações</h1>
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">Recebimentos nas faturas do CRM</h2>
          {q.data && <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{q.data.state === "ativo" ? "Ativo" : "Em preparação"}</span>}
        </div>
        {q.isLoading && <Skeleton className="h-24 w-full" />}
        {q.isError && <ErrorState title="Não foi possível carregar" description="Tente novamente." />}
        {q.data && (
          <>
            <p className="text-sm text-muted-foreground">Uma fatura por projeto, sem envio ao cliente. Cada recebimento confirmado pelo admin registra só a parcela recebida.</p>
            <ul className="space-y-1 text-sm">
              {Object.entries(q.data.gates).map(([k, v]) => (
                <li key={k} className="flex justify-between gap-2"><span>{GATE_LABEL[k]}</span><span className={v ? "text-primary" : "text-muted-foreground"}>{v ? "OK" : "Pendente"}</span></li>
              ))}
            </ul>
            {q.data.pendingReasons.length > 0 && (
              <ul className="text-sm">{q.data.pendingReasons.map((p) => <li key={p.reason}>{p.reason}: {p.count}</li>)}</ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
