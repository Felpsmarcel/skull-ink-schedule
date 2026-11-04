// Worker for mirroring confirmed receipts into GHL Invoices.
// DISABLED by default: requires PAYMENT_MIRROR_ENABLED === "true" AND every activation gate.
// Store and transport are injected; tests use in-memory fakes. Never calls /send, never charges cards.
// Uncertain outcomes (timeout, cut connection, invalid response, lease lost after POST) become
// "a_conciliar" and are only resolved by exact-marker reconciliation, never by blind resend.

import {
  GF_LOCATION_ID, gatesOpen, planInvoice, planPayment, reconcileInvoice, reconcilePayment,
  type ActivationGates, type Contact, type CreateInvoiceBody, type InvoiceLink, type Project,
  type Receipt, type RecordPaymentBody, type RemoteInvoice, type RemoteTransaction, type StudioDetails,
} from "./payment-mirror-core";

export type RowState = "pending" | "fatura_a_conciliar" | "pagamento_a_conciliar" | "revisao" | "concluido";

export interface OutboxRow { id: string; leaseToken: string; attempts: number; state: RowState; receipt: Receipt }

export interface MirrorStore {
  claim(limit: number): Promise<OutboxRow[]>;
  lockProject(row: OutboxRow, projectId: string): Promise<boolean>; // per project/invoice lock under lease
  loadContext(row: OutboxRow): Promise<{ project: Project | null; link: InvoiceLink | null; contact: Contact | null; studio: StudioDetails | null; contactInvoicesWithoutLink: number }>;
  /** Persist in-flight marker BEFORE network write. false = lease lost → do not POST. */
  markInFlight(row: OutboxRow, phase: "create" | "record"): Promise<boolean>;
  /** Unique (location_id, project_id). false = another link exists → review. */
  saveLink(row: OutboxRow, link: InvoiceLink): Promise<boolean>;
  setState(row: OutboxRow, state: RowState, reason: string | null, extra?: { ghlTransactionId?: string; retryable?: boolean }): Promise<boolean>;
}

export interface MirrorTransport {
  createInvoice(body: CreateInvoiceBody, s: AbortSignal): Promise<{ status: number; invoiceId: string | null }>;
  getInvoice(id: string, s: AbortSignal): Promise<{ status: number; invoice: RemoteInvoice | null }>;
  recordPayment(invoiceId: string, body: RecordPaymentBody, s: AbortSignal): Promise<{ status: number; transactionId: string | null }>;
  listInvoicesByContact(contactId: string, s: AbortSignal): Promise<RemoteInvoice[]>; // paginated by adapter
  listTransactionsByInvoice(invoiceId: string, s: AbortSignal): Promise<RemoteTransaction[]>;
}

export interface RunResult { enabled: boolean; done: number; pending: number; unknown: number; review: number; retry: number }

export const MAX_ATTEMPTS = 5;

async function withTimeout<T>(ms: number, fn: (s: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await Promise.race([
      fn(ctrl.signal),
      new Promise<never>((_, rej) => ctrl.signal.addEventListener("abort", () => rej(Object.assign(new Error("timeout"), { name: "AbortError" })))),
    ]);
  } finally { clearTimeout(t); }
}

const isRetryableHttp = (s: number) => s === 429 || s >= 500;

export async function runPaymentMirror(opts: {
  gates: ActivationGates; store: MirrorStore; transport: MirrorTransport; limit?: number; timeoutMs?: number;
}): Promise<RunResult> {
  const res: RunResult = { enabled: gatesOpen(opts.gates), done: 0, pending: 0, unknown: 0, review: 0, retry: 0 };
  if (!res.enabled) return res; // no DB, no fetch
  const { store, transport } = opts;
  const ms = opts.timeoutMs ?? 10_000;
  const rows = await store.claim(opts.limit ?? 20);

  for (const row of rows) {
    const ctx = await store.loadContext(row);
    const projectId = row.receipt.projectId;

    // ---- uncertain rows: reconcile only ----
    if (row.state === "fatura_a_conciliar" || row.state === "pagamento_a_conciliar") {
      await reconcileRow(row, ctx, store, transport, ms, res);
      continue;
    }

    if (!projectId || !(await store.lockProject(row, projectId))) {
      await store.setState(row, "pending", projectId ? "projeto_bloqueado" : "projeto_ausente", { retryable: !!projectId });
      res.pending++; continue;
    }

    const plan = planInvoice({ receipt: row.receipt, ...ctx });
    if (plan.kind === "pending") { await store.setState(row, "pending", plan.reason); res.pending++; continue; }

    let invoiceId: string;
    if (plan.kind === "create") {
      if (!(await store.markInFlight(row, "create"))) { res.review++; continue; }
      let r: { status: number; invoiceId: string | null };
      try { r = await withTimeout(ms, (s) => transport.createInvoice(plan.body, s)); }
      catch { await store.setState(row, "fatura_a_conciliar", "resultado_desconhecido"); res.unknown++; continue; }
      if (r.status >= 200 && r.status < 300 && !r.invoiceId) { await store.setState(row, "fatura_a_conciliar", "resposta_invalida"); res.unknown++; continue; }
      if (r.status < 200 || r.status >= 300) { await failHttp(row, r.status, store, res); continue; }
      const saved = await store.saveLink(row, { locationId: GF_LOCATION_ID, projectId, invoiceId: r.invoiceId as string });
      if (!saved) { await store.setState(row, "revisao", "vinculo_concorrente"); res.review++; continue; }
      invoiceId = r.invoiceId as string;
    } else invoiceId = plan.invoiceId;

    await recordStep(row, invoiceId, projectId, store, transport, ms, res);
  }
  return res;
}

async function failHttp(row: OutboxRow, status: number, store: MirrorStore, res: RunResult) {
  if (isRetryableHttp(status) && row.attempts + 1 < MAX_ATTEMPTS) { await store.setState(row, "pending", `http_${status}`, { retryable: true }); res.retry++; }
  else { await store.setState(row, "revisao", `http_${status}`); res.review++; }
}

async function recordStep(row: OutboxRow, invoiceId: string, projectId: string, store: MirrorStore, t: MirrorTransport, ms: number, res: RunResult) {
  let g: { status: number; invoice: RemoteInvoice | null };
  try { g = await withTimeout(ms, (s) => t.getInvoice(invoiceId, s)); }
  catch { await store.setState(row, "pending", "leitura_falhou", { retryable: true }); res.retry++; return; }
  if (g.status < 200 || g.status >= 300 || !g.invoice) { await failHttp(row, g.status || 502, store, res); return; }
  const pp = planPayment(row.receipt, g.invoice, projectId);
  if (pp.kind === "pending") { await store.setState(row, "revisao", pp.reason); res.review++; return; }
  if (!(await store.markInFlight(row, "record"))) { res.review++; return; }
  let r: { status: number; transactionId: string | null };
  try { r = await withTimeout(ms, (s) => t.recordPayment(invoiceId, pp.body, s)); }
  catch { await store.setState(row, "pagamento_a_conciliar", "resultado_desconhecido"); res.unknown++; return; }
  if (r.status >= 200 && r.status < 300) {
    if (!r.transactionId) { await store.setState(row, "pagamento_a_conciliar", "resposta_invalida"); res.unknown++; return; }
    const ok = await store.setState(row, "concluido", null, { ghlTransactionId: r.transactionId });
    if (!ok) { res.unknown++; return; } // lease lost after POST: row stays in-flight → reconcile later
    res.done++; return;
  }
  await failHttp(row, r.status, store, res);
}

async function reconcileRow(row: OutboxRow, ctx: Awaited<ReturnType<MirrorStore["loadContext"]>>, store: MirrorStore, t: MirrorTransport, ms: number, res: RunResult) {
  const r = row.receipt;
  try {
    if (row.state === "fatura_a_conciliar") {
      if (!ctx.project || !r.ghlContactId) { res.review++; return; }
      const list = await withTimeout(ms, (s) => t.listInvoicesByContact(r.ghlContactId as string, s));
      const rec = reconcileInvoice(list, ctx.project, r.ghlContactId);
      if (rec.kind === "pending") { await store.setState(row, "fatura_a_conciliar", rec.reason); res.unknown++; return; }
      const saved = await store.saveLink(row, { locationId: GF_LOCATION_ID, projectId: ctx.project.id, invoiceId: rec.value.id });
      await store.setState(row, saved ? "pending" : "revisao", saved ? "fatura_conciliada" : "vinculo_concorrente");
      res.pending++; return;
    }
    if (!ctx.link) { res.review++; return; }
    const txs = await withTimeout(ms, (s) => t.listTransactionsByInvoice(ctx.link!.invoiceId, s));
    const rec = reconcilePayment(txs, r, ctx.link.invoiceId);
    if (rec.kind === "pending") { await store.setState(row, "pagamento_a_conciliar", rec.reason); res.unknown++; return; }
    await store.setState(row, "concluido", null, { ghlTransactionId: rec.value.id }); res.done++;
  } catch { res.unknown++; }
}

export function readActivationGates(): ActivationGates {
  return {
    flag: process.env["PAYMENT_MIRROR_ENABLED"] === "true",
    scopesVerified: process.env["PAYMENT_MIRROR_SCOPES_VERIFIED"] === "true",
    contractVerified: process.env["PAYMENT_MIRROR_CONTRACT_VERIFIED"] === "true",
    workflowsReviewed: process.env["PAYMENT_MIRROR_WORKFLOWS_REVIEWED"] === "true",
  };
}
export const isPaymentMirrorEnabled = () => gatesOpen(readActivationGates());
