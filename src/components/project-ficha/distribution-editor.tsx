import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAllocationDraft, saveAllocationDraft } from "@/lib/project-allocation.functions";
import type { AllocationAdapter } from "@/lib/project-allocation-adapter";
import { ALLOCATION_ERROR_TEXT, newIdempotencyKey } from "@/lib/project-allocation-core";
import { Button } from "@/components/ui/button";
import { formatEurCents } from "@/lib/project-progress-core";
import {
  forecastCommission,
  parseEuroToCents,
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

type SaveState =
  | { kind: "loading" }
  | { kind: "disabled" }
  | { kind: "load_failed" }
  | { kind: "clean"; at: string | null }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "conflict" }
  | { kind: "failed"; text: string };

function useProductionAdapter(projectId: string): AllocationAdapter {
  const load = useServerFn(getAllocationDraft);
  const save = useServerFn(saveAllocationDraft);
  return useMemo(
    () => ({
      environment: "production" as const,
      load: () => load({ data: { projectId } }),
      save: (i) => save({ data: { projectId, ...i } }),
    }),
    [projectId, load, save],
  );
}

const centsText = (v: number) => (v / 100).toFixed(2).replace(".", ",");

export function DistributionEditor(props: {
  projectId: string;
  contractCents: number | null;
  sessions: EditorSession[];
  adapter?: AllocationAdapter;
}) {
  const prod = useProductionAdapter(props.projectId);
  return <DistributionEditorInner {...props} adapter={props.adapter ?? prod} />;
}

function DistributionEditorInner({
  contractCents,
  sessions,
  adapter,
}: {
  projectId: string;
  contractCents: number | null;
  sessions: EditorSession[];
  adapter: AllocationAdapter;
}) {
  const active = sessions.filter((s) => s.status !== "cancelled");
  const [alloc, setAlloc] = useState<Allocation>({});
  const [text, setText] = useState<Record<string, string>>({});
  const [bad, setBad] = useState<Record<string, boolean>>({});

  const summary = useMemo(
    () => summarizeDistribution(contractCents, sessions, alloc),
    [contractCents, sessions, alloc],
  );
  const forecast = useMemo(() => forecastCommission(active, alloc), [active, alloc]);
  const anyBad = Object.values(bad).some(Boolean);
  const [save, setSave] = useState<SaveState>({ kind: "loading" });
  const [version, setVersion] = useState(0);
  const [frozen, setFrozen] = useState<string[]>([]);
  const keyRef = useRef<string | null>(null);

  const applyLoaded = useCallback((lines: Record<string, number>) => {
    setAlloc(lines);
    setText(Object.fromEntries(Object.entries(lines).map(([k, v]) => [k, centsText(v)])));
    setBad({});
  }, []);

  const reload = useCallback(async () => {
    setSave({ kind: "loading" });
    try {
      const r = await adapter.load();
      if (r.state === "disabled") return setSave({ kind: "disabled" });
      setVersion(r.version);
      setFrozen(r.frozen);
      applyLoaded(r.lines);
      keyRef.current = null;
      setSave({ kind: "clean", at: r.updatedAt });
    } catch {
      setSave({ kind: "load_failed" });
    }
  }, [adapter, applyLoaded]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const markDirty = () => {
    keyRef.current = null;
    setSave((s) => (s.kind === "disabled" || s.kind === "loading" ? s : { kind: "dirty" }));
  };

  const persist = async () => {
    if (save.kind === "saving") return;
    // Mesma chave para cliques repetidos da mesma edição: o servidor não cria versão nova.
    keyRef.current ??= newIdempotencyKey();
    setSave({ kind: "saving" });
    const lines = Object.entries(alloc)
      .filter((e): e is [string, number] => typeof e[1] === "number")
      .map(([appointmentId, amountCents]) => ({ appointmentId, amountCents }));
    try {
      const r = await adapter.save({
        expectedVersion: version,
        idempotencyKey: keyRef.current,
        lines,
      });
      if (r.state === "saved") {
        setVersion(r.version);
        setSave({ kind: "saved", at: new Date().toISOString() });
      } else if (r.state === "conflict") setSave({ kind: "conflict" });
      else if (r.state === "disabled") setSave({ kind: "disabled" });
      else setSave({ kind: "failed", text: ALLOCATION_ERROR_TEXT[r.reason] });
    } catch {
      setSave({ kind: "failed", text: ALLOCATION_ERROR_TEXT.unknown });
    }
  };

  const update = (id: string, raw: string) => {
    setText((t) => ({ ...t, [id]: raw }));
    const c = parseEuroToCents(raw);
    const invalid = c !== null && Number.isNaN(c);
    setBad((b) => ({ ...b, [id]: invalid }));
    const next = { ...alloc, [id]: invalid ? null : c };
    setAlloc(next);
    markDirty();
  };

  const splitEven = () => {
    if (!contractCents || active.length === 0) return;
    const base = Math.floor(contractCents / active.length);
    const rest = contractCents - base * active.length;
    const next: Allocation = {};
    active.forEach((s, i) => (next[s.id] = base + (i < rest ? 1 : 0)));
    setAlloc(next);
    setText(
      Object.fromEntries(
        Object.entries(next).map(([k, v]) => [k, ((v ?? 0) / 100).toFixed(2).replace(".", ",")]),
      ),
    );
    setBad({});
    markDirty();
  };

  const reset = () => {
    setAlloc(Object.fromEntries(frozen.map((id) => [id, alloc[id] ?? null])));
    setText(Object.fromEntries(frozen.map((id) => [id, text[id] ?? ""])));
    setBad({});
    markDirty();
  };

  const over = summary.issues.find((i) => i.kind === "exceeds_contract");

  return (
    <section aria-labelledby="dist-title" className="ficha-panel space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="dist-title" className="font-editorial text-lg">
          Distribuição por sessão
        </h3>
        <SaveBadge state={save} env={adapter.environment} />
      </div>

      <dl className="grid grid-cols-3 gap-3 border-y border-border py-3 text-sm">
        <Fig label="Contratado" v={summary.contractCents} />
        <Fig label="Distribuído" v={summary.distributedCents} />
        <Fig
          label={
            summary.remainingCents !== null && summary.remainingCents < 0
              ? "Excesso"
              : "A distribuir"
          }
          v={summary.remainingCents === null ? null : Math.abs(summary.remainingCents)}
          tone={summary.remainingCents !== null && summary.remainingCents < 0 ? "bad" : undefined}
        />
      </dl>

      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma sessão ativa vinculada para distribuir.
        </p>
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
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    €
                  </span>
                  <input
                    readOnly={frozen.includes(s.id)}
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
                      {f.recognized ? "Realizada" : "Estimativa"} · {f.pct}% →{" "}
                      {formatEurCents(f.shareCents)}
                      {f.source === "frozen" ? " · repasse congelado" : ""}
                    </>
                  )}
                  {f?.completedWithoutEvidence ? (
                    <span className="ml-1 font-medium text-warning">
                      · concluída sem data de realização comprovada — não reconhecida
                    </span>
                  ) : null}
                  {f?.divergentSnapshot ? (
                    <span className="ml-1 font-medium text-warning">
                      · gravado {s.snapshotPct}% difere da regra (não retificado)
                    </span>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      <div aria-live="polite" className="space-y-1 text-sm">
        {anyBad ? <p className="text-destructive">Valor inválido em uma sessão.</p> : null}
        {over ? (
          <p className="text-destructive">
            Distribuição excede o contrato em {formatEurCents(over.overCents)}.
          </p>
        ) : null}
        {summary.issues
          .filter((i) => i.kind !== "exceeds_contract")
          .map((i, n) => (
            <p key={n} className="text-destructive">
              {ISSUE_TEXT[i.kind]}
            </p>
          ))}
        {summary.valid && !anyBad && summary.remainingCents === 0 ? (
          <p className="text-success">Contrato distribuído integralmente.</p>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        {forecast.rows.some((r) => r.recognized) ? (
          <Fig label="Parte do tatuador realizada" v={forecast.realizedCents} />
        ) : (
          <div>
            <dt className="text-xs text-muted-foreground">Parte do tatuador realizada</dt>
            <dd className="text-sm">Nenhuma sessão realizada</dd>
          </div>
        )}
        <Fig label="Parte do tatuador estimada (futuras)" v={forecast.estimatedCents} />
      </dl>
      <p className="text-xs text-muted-foreground">
        Previsão pela data da sessão em Bruxelas. Estimativa não é ganho reconhecido nem repasse.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="min-h-11"
          onClick={splitEven}
          disabled={!contractCents || active.length === 0 || frozen.length > 0}
        >
          Dividir igualmente
        </Button>
        <Button variant="ghost" className="min-h-11" onClick={reset}>
          Limpar rascunho
        </Button>
        {save.kind !== "disabled" && save.kind !== "load_failed" ? (
          <Button
            className="min-h-11"
            onClick={persist}
            aria-busy={save.kind === "saving"}
            disabled={
              save.kind === "saving" ||
              save.kind === "loading" ||
              save.kind === "conflict" ||
              anyBad ||
              !summary.valid
            }
          >
            {save.kind === "saving" ? "Salvando…" : "Salvar rascunho"}
          </Button>
        ) : null}
        {save.kind === "conflict" || save.kind === "load_failed" ? (
          <Button variant="outline" className="min-h-11" onClick={() => void reload()}>
            Recarregar versão salva
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Rascunho salvo é planejamento: não é recebimento, comissão apurada nem repasse.
      </p>
    </section>
  );
}

function SaveBadge({ state, env }: { state: SaveState; env: "production" | "fixture" }) {
  const base = "rounded-sm border px-2 py-0.5 text-xs font-medium";
  const warn = `${base} border-warning/40 bg-warning/10 text-warning`;
  const ok = `${base} border-success/40 bg-success/10 text-success`;
  const bad = `${base} border-destructive/40 bg-destructive/10 text-destructive`;
  const envTag = env === "fixture" ? "Fixture (memória desta aba) · " : "";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Brussels",
    });
  const map: Record<SaveState["kind"], [string, string]> = {
    loading: [warn, "Carregando rascunho salvo…"],
    disabled: [
      warn,
      "Salvamento com ativação pendente — rascunho só nesta tela, descartado ao sair",
    ],
    load_failed: [bad, "Falha ao carregar o rascunho salvo — nada exibido como salvo"],
    clean: [
      ok,
      state.kind === "clean" && state.at ? `Salvo · ${fmt(state.at)}` : "Nenhum rascunho salvo",
    ],
    dirty: [warn, "Alterações não salvas"],
    saving: [warn, "Salvando…"],
    saved: [ok, state.kind === "saved" ? `Salvo · ${fmt(state.at)}` : "Salvo"],
    conflict: [bad, "Conflito: outra aba salvou uma versão mais nova. Recarregue antes de salvar."],
    failed: [bad, state.kind === "failed" ? `Falha: ${state.text}` : "Falha"],
  };
  const [cls, label] = map[state.kind];
  return (
    <span role="status" aria-live="polite" className={cls}>
      {envTag}
      {label}
    </span>
  );
}

function Fig({ label, v, tone }: { label: string; v: number | null; tone?: "bad" }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums font-medium ${tone === "bad" ? "text-destructive" : ""}`}>
        {formatEurCents(v)}
      </dd>
    </div>
  );
}
