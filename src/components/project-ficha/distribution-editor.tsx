import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatEurCents } from "@/lib/project-progress-core";
import {
  clearDraft,
  forecastCommission,
  loadDraft,
  parseEuroToCents,
  saveDraft,
  summarizeDistribution,
  type Allocation,
  type DistributionSession,
} from "@/lib/project-distribution-core";
import { formatProjectDate } from "@/lib/project-journey-core";

export interface EditorSession extends DistributionSession {
  index: number;
  artistName: string | null;
}

const ISSUE_TEXT: Record<string, string> = {
  negative: "Valor negativo não é permitido.",
  not_integer: "Use no máximo duas casas decimais.",
  unknown_session: "Há valor para uma sessão que não pertence a este projeto.",
  cancelled_session: "Sessão cancelada não recebe valor.",
  contract_unknown: "Valor contratado a apurar: a distribuição não pode ser validada.",
};

export function DistributionEditor({
  projectId,
  contractCents,
  sessions,
  persist = true,
}: {
  projectId: string;
  contractCents: number | null;
  sessions: EditorSession[];
  /** false em fixtures: rascunho só em memória. */
  persist?: boolean;
}) {
  const active = sessions.filter((s) => s.status !== "cancelled");
  const [alloc, setAlloc] = useState<Allocation>({});
  const [text, setText] = useState<Record<string, string>>({});
  const [bad, setBad] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!persist) return;
    const d = loadDraft(projectId);
    setAlloc(d);
    setText(
      Object.fromEntries(
        Object.entries(d).map(([k, v]) => [k, v === null ? "" : (v / 100).toFixed(2).replace(".", ",")]),
      ),
    );
  }, [projectId, persist]);

  const summary = useMemo(
    () => summarizeDistribution(contractCents, sessions, alloc),
    [contractCents, sessions, alloc],
  );
  const forecast = useMemo(() => forecastCommission(active, alloc), [active, alloc]);
  const anyBad = Object.values(bad).some(Boolean);

  const update = (id: string, raw: string) => {
    setText((t) => ({ ...t, [id]: raw }));
    const c = parseEuroToCents(raw);
    const invalid = c !== null && Number.isNaN(c);
    setBad((b) => ({ ...b, [id]: invalid }));
    const next = { ...alloc, [id]: invalid ? null : c };
    setAlloc(next);
    if (persist && !invalid) saveDraft(projectId, next);
  };

  const splitEven = () => {
    if (!contractCents || active.length === 0) return;
    const base = Math.floor(contractCents / active.length);
    const rest = contractCents - base * active.length;
    const next: Allocation = {};
    active.forEach((s, i) => (next[s.id] = base + (i < rest ? 1 : 0)));
    setAlloc(next);
    setText(Object.fromEntries(Object.entries(next).map(([k, v]) => [k, ((v ?? 0) / 100).toFixed(2).replace(".", ",")])));
    setBad({});
    if (persist) saveDraft(projectId, next);
  };

  const reset = () => {
    setAlloc({});
    setText({});
    setBad({});
    if (persist) clearDraft(projectId);
  };

  const over = summary.issues.find((i) => i.kind === "exceeds_contract");

  return (
    <section aria-labelledby="dist-title" className="ficha-panel space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="dist-title" className="font-editorial text-lg">Distribuição por sessão</h3>
        <span className="rounded-sm border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
          Rascunho {persist ? "neste aparelho" : "de demonstração"} — não salvo no sistema
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-3 border-y border-border py-3 text-sm">
        <Fig label="Contratado" v={summary.contractCents} />
        <Fig label="Distribuído" v={summary.distributedCents} />
        <Fig
          label={summary.remainingCents !== null && summary.remainingCents < 0 ? "Excesso" : "A distribuir"}
          v={summary.remainingCents === null ? null : Math.abs(summary.remainingCents)}
          tone={summary.remainingCents !== null && summary.remainingCents < 0 ? "bad" : undefined}
        />
      </dl>

      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma sessão ativa vinculada para distribuir.</p>
      ) : (
        <ol className="space-y-3">
          {active.map((s) => {
            const f = forecast.rows.find((r) => r.sessionId === s.id);
            const id = `dist-${s.id}`;
            return (
              <li key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                <label htmlFor={id} className="min-w-0">
                  <span className="block text-sm font-medium">
                    Sessão {s.index} · {s.artistName ?? "Tatuador a definir"}
                  </span>
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {formatProjectDate(s.startAt)}
                  </span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                  <input
                    id={id}
                    inputMode="decimal"
                    autoComplete="off"
                    value={text[s.id] ?? ""}
                    onChange={(e) => update(s.id, e.target.value)}
                    aria-invalid={bad[s.id] || undefined}
                    placeholder="0,00"
                    className="h-11 w-32 rounded-md border border-input bg-card pl-7 pr-3 text-right text-base tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid]:border-destructive"
                  />
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  {f?.pct == null ? (
                    "Percentual a apurar"
                  ) : (
                    <>
                      {f.recognized ? "Realizada" : "Estimativa"} · {f.pct}% → {formatEurCents(f.shareCents)}
                      {f.source === "frozen" ? " · repasse congelado" : ""}
                    </>
                  )}
                  {f?.divergentSnapshot ? (
                    <span className="ml-1 font-medium text-warning">· gravado {s.snapshotPct}% difere da regra (não retificado)</span>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      <div aria-live="polite" className="space-y-1 text-sm">
        {anyBad ? <p className="text-destructive">Valor inválido em uma sessão.</p> : null}
        {over ? <p className="text-destructive">Distribuição excede o contrato em {formatEurCents(over.overCents)}.</p> : null}
        {summary.issues
          .filter((i) => i.kind !== "exceeds_contract")
          .map((i, n) => <p key={n} className="text-destructive">{ISSUE_TEXT[i.kind]}</p>)}
        {summary.valid && !anyBad && summary.remainingCents === 0 ? (
          <p className="text-success">Contrato distribuído integralmente.</p>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Fig label="Parte do tatuador realizada" v={forecast.realizedCents} />
        <Fig label="Parte do tatuador estimada (futuras)" v={forecast.estimatedCents} />
      </dl>
      <p className="text-xs text-muted-foreground">
        Previsão pela data da sessão em Bruxelas. Estimativa não é ganho reconhecido nem repasse.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="min-h-11" onClick={splitEven} disabled={!contractCents || active.length === 0}>
          Dividir igualmente
        </Button>
        <Button variant="ghost" className="min-h-11" onClick={reset}>
          Limpar rascunho
        </Button>
      </div>
    </section>
  );
}

function Fig({ label, v, tone }: { label: string; v: number | null; tone?: "bad" }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums font-medium ${tone === "bad" ? "text-destructive" : ""}`}>{formatEurCents(v)}</dd>
    </div>
  );
}
