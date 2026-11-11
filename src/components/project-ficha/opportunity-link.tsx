import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatEurCents } from "@/lib/project-progress-core";
import {
  ALLOCATION_ERROR_TEXT,
  evaluateOpportunityLink,
  newIdempotencyKey,
} from "@/lib/project-allocation-core";
import {
  getProjectOpportunityLinks,
  linkProjectOpportunity,
} from "@/lib/project-allocation.functions";
import type { ProjectOpportunitiesResult } from "@/lib/projects.functions";

type Opportunity = ProjectOpportunitiesResult["items"][number];
/** Fixture is deliberately component memory; real persistence remains server gated. */
export function OpportunityLink({
  projectId,
  opportunity,
  contractCents,
  fixture = false,
}: {
  projectId: string;
  opportunity: Opportunity | undefined;
  contractCents: number | null;
  fixture?: boolean;
}) {
  const [enabled, setEnabled] = useState(fixture);
  const [open, setOpen] = useState(false);
  const [keep, setKeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [linked, setLinked] = useState<string[]>([]);
  const pending = useRef(false);
  const key = useRef("");
  useEffect(() => {
    if (fixture) return;
    let current = true;
    getProjectOpportunityLinks({ data: { projectId } })
      .then((r) => {
        if (current) {
          setEnabled(r.enabled);
          setLinked(r.ids);
        }
      })
      .catch(() => {
        if (current) setMessage("Não foi possível verificar o salvamento.");
      });
    return () => {
      current = false;
    };
  }, [projectId, fixture]);
  const evaluation = opportunity
    ? evaluateOpportunityLink({
        status: opportunity.status,
        valueCents: opportunity.monetaryValueCents,
        contractCents,
        keepContract: keep,
      })
    : null;
  const usable =
    opportunity &&
    opportunity.inArtistPipeline &&
    !opportunity.linkedElsewhereProjectId &&
    !opportunity.linkedHere &&
    !linked.includes(opportunity.id);
  async function submit() {
    if (!opportunity || !usable || evaluation?.needsDecision || pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = fixture
        ? { state: "linked" as const }
        : await linkProjectOpportunity({
            data: {
              projectId,
              opportunityId: opportunity.id,
              keepContract: keep,
              idempotencyKey: key.current,
            },
          });
      if (result.state === "linked") {
        setLinked((ids) => [...ids, opportunity.id]);
        setOpen(false);
        setMessage(
          fixture
            ? "Vínculo simulado na memória desta ficha. Descartado ao sair ou recarregar."
            : "Oportunidade vinculada ao projeto. Contrato preservado.",
        );
      } else
        setMessage(
          result.state === "disabled"
            ? "Salvamento com ativação pendente."
            : ALLOCATION_ERROR_TEXT[result.reason],
        );
    } catch {
      setMessage("Resposta não confirmada. Você pode tentar novamente com a mesma chave de envio.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      {!enabled ? (
        <p className="text-xs text-muted-foreground">Vínculo com ativação pendente.</p>
      ) : (
        <Button
          className="min-h-11"
          disabled={!usable}
          onClick={() => {
            setKeep(false);
            setMessage("");
            key.current = newIdempotencyKey();
            setOpen(true);
          }}
        >
          Vincular oportunidade
        </Button>
      )}
      {linked.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {linked.length} vínculo(s) {fixture ? "simulado(s)" : "confirmado(s)"} nesta ficha.
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent>
          <DialogTitle>Vincular oportunidade</DialogTitle>
          <DialogDescription>
            Relaciona a contratação ao projeto. Não registra pagamento nem altera o contrato ou o
            GHL.
          </DialogDescription>
          <p>
            {opportunity?.name ?? "Sem nome"} · {opportunity?.status}
          </p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt>Oportunidade</dt>
            <dd>{formatEurCents(opportunity?.monetaryValueCents ?? null)}</dd>
            <dt>Contrato preservado</dt>
            <dd>{formatEurCents(contractCents)}</dd>
          </dl>
          {evaluation?.kind === "historical" ? (
            <p>Vínculo somente histórico: oportunidade perdida ou abandonada.</p>
          ) : (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={keep}
                disabled={busy}
                onChange={(e) => setKeep(e.target.checked)}
              />
              Manter o valor atual do contrato mesmo se houver divergência.
            </label>
          )}
          {message && <p role="alert">{message}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={busy || !usable || evaluation?.needsDecision} onClick={submit}>
              {busy ? "Vinculando…" : "Confirmar vínculo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
