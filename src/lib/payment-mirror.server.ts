// Worker for mirroring confirmed receipts into existing GHL invoices.
// DISABLED unless PAYMENT_MIRROR_ENABLED === "true". Transport and store are
// injected so tests run without database or CRM. Never creates or sends invoices.

import { decide, GF_LOCATION_ID, type InvoiceCandidate, type MirrorItem, type RecordPaymentBody } from "./payment-mirror-core";

export interface OutboxRow { id: string; leaseToken: string; attempts: number; item: MirrorItem }

export interface MirrorStore {
  claim(limit: number): Promise<OutboxRow[]>; // lease-fenced claim
  markSent(row: OutboxRow, ghlPaymentRef: string | null): Promise<boolean>; // false = lost lease
  markQueued(row: OutboxRow, reason: string): Promise<void>;
  markFailed(row: OutboxRow, reason: string, retryable: boolean): Promise<void>;
}

export interface MirrorTransport {
  listInvoices(contactId: string, signal: AbortSignal): Promise<InvoiceCandidate[]>;
  recordPayment(invoiceId: string, body: RecordPaymentBody, signal: AbortSignal): Promise<{ status: number; ref: string | null }>;
}

export interface RunResult { enabled: boolean; sent: number; queued: number; failed: number }

export const MAX_ATTEMPTS = 5;

async function withTimeout<T>(ms: number, fn: (s: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fn(ctrl.signal); } finally { clearTimeout(t); }
}

export async function runPaymentMirror(opts: {
  enabled: boolean; store: MirrorStore; transport: MirrorTransport; limit?: number; timeoutMs?: number;
}): Promise<RunResult> {
  const res: RunResult = { enabled: opts.enabled, sent: 0, queued: 0, failed: 0 };
  if (!opts.enabled) return res;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const rows = await opts.store.claim(opts.limit ?? 20);
  for (const row of rows) {
    try {
      const contactId = row.item.ghlContactId;
      const invoices = contactId ? await withTimeout(timeoutMs, (s) => opts.transport.listInvoices(contactId, s)) : [];
      const d = decide(row.item, invoices);
      if (d.kind === "queue") { await opts.store.markQueued(row, d.reason); res.queued++; continue; }
      if (d.kind === "fail") { await opts.store.markFailed(row, d.reason, false); res.failed++; continue; }
      if (d.body.altId !== GF_LOCATION_ID) throw new Error("location_estrangeira");
      const r = await withTimeout(timeoutMs, (s) => opts.transport.recordPayment(d.invoiceId, d.body, s));
      if (r.status < 200 || r.status >= 300) {
        const retryable = r.status === 429 || r.status >= 500;
        await opts.store.markFailed(row, `http_${r.status}`, retryable && row.attempts + 1 < MAX_ATTEMPTS);
        res.failed++; continue;
      }
      await opts.store.markSent(row, r.ref);
      res.sent++;
    } catch (e) {
      // Timeout/network: outcome unknown. Retry reuses the same externalId; no payload logged.
      const reason = e instanceof Error && e.name === "AbortError" ? "timeout" : "erro_transporte";
      await opts.store.markFailed(row, reason, row.attempts + 1 < MAX_ATTEMPTS);
      res.failed++;
    }
  }
  return res;
}

export function isPaymentMirrorEnabled(): boolean {
  return process.env["PAYMENT_MIRROR_ENABLED"] === "true";
}
