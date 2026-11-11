/**
 * Cálculo puro do progresso e saldo de um projeto multi-sessões.
 * Euro em centavos inteiros; valores ausentes => null ("A apurar"), nunca zero.
 */
export type SessionStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";

export interface SessionInput {
  id: string;
  startAt: string;
  status: SessionStatus | string;
}

export interface PaymentInput {
  total: number | string | null;
  tipo: string;
}

export const ARTIST_SHARE_PCT = 35;

export function toCents(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function sessionProgress(sessions: SessionInput[], nowMs: number) {
  const active = sessions
    .filter((s) => s.status !== "cancelled")
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const done = active.filter((s) => s.status === "completed").length;
  const next = active.find(
    (s) => (s.status === "pending" || s.status === "confirmed") && Date.parse(s.startAt) >= nowMs,
  );
  return { total: active.length, done, nextStartAt: next?.startAt ?? null };
}

/** Recebido = soma de pagamentos (estornos subtraem). Qualquer valor inválido torna o total null. */
export function receivedCents(payments: PaymentInput[]): number | null {
  let sum = 0;
  for (const p of payments) {
    const c = toCents(p.total);
    if (c === null || c < 0) return null;
    sum += p.tipo === "estorno" ? -c : c;
  }
  return sum;
}

/** Saldo = integral − recebido; null quando o integral ou o recebido não estão apurados. */
export function balanceCents(quotedCents: number | null, received: number | null): number | null {
  if (quotedCents === null || quotedCents <= 0 || received === null) return null;
  return Math.max(0, quotedCents - received);
}

/** Parte do artista (35%) sobre o efetivamente recebido, arredondada ao centavo (half-up). */
export function artistShareCents(received: number | null): number | null {
  if (received === null) return null;
  return Math.round((Math.max(0, received) * ARTIST_SHARE_PCT) / 100);
}

export function formatEurCents(c: number | null): string {
  if (c === null) return "A apurar";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(c / 100);
}
