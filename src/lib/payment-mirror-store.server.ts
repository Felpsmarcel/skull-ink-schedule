// Concrete MirrorStore over the reviewed SQL RPCs (docs/sql/payment-mirror-outbox.review.sql).
// Only usable after that SQL is applied; the worker never instantiates it while gates are closed.
import { GF_LOCATION_ID, type LocalMethod, type Receipt } from "./payment-mirror-core";
import type { MirrorContext, MirrorStore, OutboxRow, RowState } from "./payment-mirror.server";

export interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

interface ClaimRow { id: string; lease_token: string; attempts: number; state: RowState }
interface CtxJson {
  receipt: { id: string; project_id: string; ghl_contact_id: string; amount_cents: number; paid_on: string; method: string; sources: Array<{ source: Receipt["sources"][number]["source"]; source_id: string }> };
  project: { id: string; ghl_contact_id: string | null; ghl_opportunity_id: string | null; title: string; approved_total_eur: number | string | null } | null;
  contact: { id: string; name: string | null; email: string | null; phone: string | null } | null;
  link: { project_id: string; invoice_id: string } | null;
  studio: { name?: string | null; address?: string | null } | null;
}

const toCents = (v: number | string | null): number | null => {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const c = Math.round(n * 100);
  return Math.abs(c - n * 100) < 1e-6 ? c : null;
};

export function contextFromJson(j: CtxJson): MirrorContext {
  const receipt: Receipt = {
    receiptId: j.receipt.id,
    sources: (j.receipt.sources ?? []).map((s) => ({ source: s.source, sourceId: s.source_id })),
    confirmed: true, // only confirmed receipts exist in the ledger
    amountCents: j.receipt.amount_cents, currency: "EUR", paidOn: j.receipt.paid_on,
    method: j.receipt.method as LocalMethod, locationId: GF_LOCATION_ID,
    ghlContactId: j.receipt.ghl_contact_id, projectId: j.receipt.project_id,
  };
  return {
    receipt,
    project: j.project ? { id: j.project.id, locationId: GF_LOCATION_ID, ghlContactId: j.project.ghl_contact_id, ghlOpportunityId: j.project.ghl_opportunity_id, title: j.project.title, approvedTotalCents: toCents(j.project.approved_total_eur) } : null,
    // contacts table is fed only by the GF-fixed sync; location is the fixed studio subaccount.
    contact: j.contact ? { id: j.contact.id, locationId: GF_LOCATION_ID, name: j.contact.name, email: j.contact.email, phone: j.contact.phone } : null,
    link: j.link ? { locationId: GF_LOCATION_ID, projectId: j.link.project_id, invoiceId: j.link.invoice_id } : null,
    studio: j.studio ? { name: j.studio.name ?? null, address: j.studio.address ?? null } : null,
  };
}

export function createSupabaseMirrorStore(db: RpcClient, leaseSeconds = 120): MirrorStore {
  const call = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(`rpc_${fn}_failed`); // no payload in logs/errors
    return data as T;
  };
  return {
    async claim(limit) {
      const rows = await call<ClaimRow[]>("claim_payment_mirror", { p_limit: limit, p_lease_seconds: leaseSeconds });
      // receipt is reloaded under lease in loadContext; placeholder keeps the type honest.
      return (rows ?? []).map((r) => ({ id: r.id, leaseToken: r.lease_token, attempts: r.attempts, state: r.state, receipt: { receiptId: "", sources: [], confirmed: true, amountCents: 0, currency: "EUR", paidOn: "", method: "other", locationId: GF_LOCATION_ID, ghlContactId: null, projectId: null } }));
    },
    async loadContext(row: OutboxRow) {
      const j = await call<CtxJson | null>("mirror_load_context", { p_id: row.id, p_token: row.leaseToken });
      return j ? contextFromJson(j) : null;
    },
    markInFlight: (row, phase) => call<boolean>("mirror_mark_in_flight", { p_id: row.id, p_token: row.leaseToken, p_phase: phase }),
    saveLink: (row, invoiceId) => call<boolean>("mirror_save_link", { p_id: row.id, p_token: row.leaseToken, p_invoice: invoiceId }),
    setState: (row, state, reason, extra) => call<boolean>("mirror_set_state", {
      p_id: row.id, p_token: row.leaseToken, p_state: state, p_reason: reason,
      p_tx: extra?.ghlTransactionId ?? null, p_retry_seconds: extra?.retrySeconds ?? null,
    }),
  };
}
