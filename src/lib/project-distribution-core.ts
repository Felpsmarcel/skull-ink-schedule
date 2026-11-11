/**
 * Rascunho de distribuição do valor contratado por sessão (centavos inteiros).
 * O contrato é contado uma vez; sessões não multiplicam o valor.
 * Previsão de comissão usa a política por data de realização (Bruxelas).
 */
import { resolveSessionCommission, sessionArtistShareCents } from "@/lib/artist-commission-policy";

export interface DistributionSession {
  id: string;
  artistId: string | null;
  startAt: string;
  status: string;
  snapshotPct: number | string | null;
  frozen?: boolean;
  realizedAt?: string | null;
}

export type Allocation = Record<string, number | null>;

export type DistributionIssue =
  | { kind: "negative"; sessionId: string }
  | { kind: "not_integer"; sessionId: string }
  | { kind: "unknown_session"; sessionId: string }
  | { kind: "cancelled_session"; sessionId: string }
  | { kind: "exceeds_contract"; overCents: number }
  | { kind: "contract_unknown" };

export interface DistributionSummary {
  contractCents: number | null;
  distributedCents: number;
  remainingCents: number | null;
  issues: DistributionIssue[];
  valid: boolean;
}

export function parseEuroToCents(input: string): number | null {
  const t = input.trim().replace(/\s/g, "").replace(/€/g, "");
  if (t === "") return null;
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^-?\d+(\.\d{1,2})?$/.test(norm)) return Number.NaN;
  return Math.round(Number(norm) * 100);
}

export function summarizeDistribution(
  contractCents: number | null,
  sessions: DistributionSession[],
  alloc: Allocation,
): DistributionSummary {
  const issues: DistributionIssue[] = [];
  const byId = new Map(sessions.map((s) => [s.id, s]));
  let sum = 0;
  for (const [id, v] of Object.entries(alloc)) {
    if (v === null) continue;
    const s = byId.get(id);
    if (!s) {
      issues.push({ kind: "unknown_session", sessionId: id });
      continue;
    }
    if (s.status === "cancelled") {
      issues.push({ kind: "cancelled_session", sessionId: id });
      continue;
    }
    if (!Number.isInteger(v)) {
      issues.push({ kind: "not_integer", sessionId: id });
      continue;
    }
    if (v < 0) {
      issues.push({ kind: "negative", sessionId: id });
      continue;
    }
    sum += v;
  }
  if (contractCents === null || contractCents <= 0) issues.push({ kind: "contract_unknown" });
  else if (sum > contractCents)
    issues.push({ kind: "exceeds_contract", overCents: sum - contractCents });
  return {
    contractCents,
    distributedCents: sum,
    remainingCents: contractCents && contractCents > 0 ? contractCents - sum : null,
    issues,
    valid: issues.length === 0,
  };
}

export interface SessionForecast {
  sessionId: string;
  pct: number | null;
  shareCents: number | null;
  recognized: boolean;
  source: string;
  effectiveDate: string | null;
  /** Percentual gravado difere da política (só sinalizado, nunca retificado). */
  divergentSnapshot: boolean;
  completedWithoutEvidence: boolean;
}

export function forecastCommission(sessions: DistributionSession[], alloc: Allocation) {
  const rows: SessionForecast[] = sessions.map((s) => {
    const c = resolveSessionCommission({
      artistId: s.artistId ?? "",
      startAt: s.startAt,
      status: s.status,
      snapshotPct: s.snapshotPct,
      frozen: s.frozen,
      realizedAt: s.realizedAt ?? null,
    });
    const snap = s.snapshotPct === null ? null : Number(s.snapshotPct);
    return {
      sessionId: s.id,
      pct: c.pct,
      shareCents: sessionArtistShareCents(alloc[s.id] ?? null, c.pct),
      recognized: c.recognized,
      source: c.source,
      effectiveDate: c.effectiveDate,
      divergentSnapshot: c.source === "policy" && snap !== null && snap !== c.pct,
      completedWithoutEvidence: c.completedWithoutEvidence,
    };
  });
  const sumOrNull = (xs: SessionForecast[]) =>
    xs.some((x) => x.shareCents === null) ? null : xs.reduce((a, x) => a + (x.shareCents ?? 0), 0);
  const active = rows.filter((r) => r.source !== "not_session");
  return {
    rows,
    realizedCents: sumOrNull(active.filter((r) => r.recognized)),
    estimatedCents: sumOrNull(active.filter((r) => !r.recognized)),
  };
}

/** Projeto contado uma vez: recebido vem de movimentações; sinal é anotação, não soma. */
export function commercialTotals(input: {
  contractCents: number | null;
  receivedMovCents: number | null;
  depositNoteCents: number | null;
}) {
  return {
    contractCents: input.contractCents,
    receivedCents: input.receivedMovCents,
    depositNoteCents: input.depositNoteCents,
    balanceByMovCents:
      input.contractCents !== null && input.receivedMovCents !== null
        ? Math.max(0, input.contractCents - input.receivedMovCents)
        : null,
  };
}

/** Valor da oportunidade vs contrato: nunca equivalentes por suposição. */
export function opportunityContractDivergence(
  oppCents: number | null,
  contractCents: number | null,
): "equal" | "different" | "unknown" {
  if (oppCents === null || contractCents === null || contractCents <= 0) return "unknown";
  return oppCents === contractCents ? "equal" : "different";
}
