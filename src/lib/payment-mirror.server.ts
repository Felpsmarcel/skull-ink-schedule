// Worker for mirroring confirmed receipts into GHL Invoices.
// DISABLED by default: requires PAYMENT_MIRROR_ENABLED === "true" AND every activation gate.
// Store and transport are injected (real adapters: payment-mirror-store.server.ts / payment-mirror-transport.server.ts).
// Never calls /send, never charges cards.
// POST outcomes that may have taken effect (timeout, 408, 429, 5xx, truncated/invalid body, lease lost after POST)
// become "a_conciliar" and are only resolved by exact-marker readback — never resent blindly.
// A 2xx record-payment is NOT proof: the transaction must be read back exactly before "concluido".

import {
  GF_LOCATION_ID,
  gatesOpen,
  planInvoice,
  planPayment,
  projectMarker,
  reconcileInvoice,
  reconcilePayment,
  type ActivationGates,
  type Contact,
  type CreateInvoiceBody,
  type InvoiceLink,
  type Project,
  type Receipt,
  type RecordPaymentBody,
  type RemoteInvoice,
  type RemoteTransaction,
  type StudioDetails,
} from "./payment-mirror-core";

export type RowState =
  | "pending"
  | "fatura_a_conciliar"
  | "pagamento_a_conciliar"
  | "revisao"
  | "concluido";

export interface OutboxRow {
  id: string;
  leaseToken: string;
  attempts: number;
  state: RowState;
  receipt: Receipt;
}

export interface MirrorContext {
  receipt: Receipt;
  project: Project | null;
  link: InvoiceLink | null;
  contact: Contact | null;
  studio: StudioDetails | null;
}

export interface MirrorStore {
  /** Leases rows; the SQL claim already holds the per-project lock (one job per project). */
  claim(limit: number): Promise<OutboxRow[]>;
  /** Reload context under the current lease. null = lease lost. */
  loadContext(row: OutboxRow): Promise<MirrorContext | null>;
  /** Persist in-flight marker BEFORE network write. false = lease lost → do not POST. */
  markInFlight(row: OutboxRow, phase: "create" | "record"): Promise<boolean>;
  /** Real unique (location_id, project_id). false = different link exists or lease lost. */
  saveLink(row: OutboxRow, invoiceId: string): Promise<boolean>;
  /** Fenced. false = lease lost; caller must not count the outcome as applied. */
  setState(
    row: OutboxRow,
    state: RowState,
    reason: string | null,
    extra?: { ghlTransactionId?: string; retrySeconds?: number },
  ): Promise<boolean>;
}

export type HttpResult<T> =
  | { kind: "ok"; status: number; value: T }
  | { kind: "http"; status: number }
  | { kind: "invalid"; status: number };

export interface MirrorTransport {
  createInvoice(
    body: CreateInvoiceBody,
    s: AbortSignal,
  ): Promise<HttpResult<{ invoiceId: string }>>;
  getInvoice(id: string, s: AbortSignal): Promise<HttpResult<RemoteInvoice>>;
  /** Official response is { success, invoice }; there is no transaction id. */
  recordPayment(
    invoiceId: string,
    body: RecordPaymentBody,
    s: AbortSignal,
  ): Promise<HttpResult<{ success: boolean }>>;
  listInvoicesByContact(contactId: string, s: AbortSignal): Promise<RemoteInvoice[]>; // fully paginated
  listTransactionsByInvoice(invoiceId: string, s: AbortSignal): Promise<RemoteTransaction[]>; // fully paginated
}

export interface RunResult {
  enabled: boolean;
  done: number;
  pending: number;
  unknown: number;
  review: number;
  retry: number;
  leaseLost: number;
}

export const MAX_ATTEMPTS = 5;
const RETRY_SECONDS = 300;

async function withTimeout<T>(ms: number, fn: (s: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(ctrl.signal),
      new Promise<never>((_, rej) => {
        timer = setTimeout(() => {
          ctrl.abort();
          rej(Object.assign(new Error("timeout"), { name: "AbortError" }));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Definitive rejections of a POST: request not applied. Everything else is uncertain. */
const DEFINITIVE_REJECT = new Set([400, 401, 403, 404, 422]);

export async function runPaymentMirror(opts: {
  gates: ActivationGates;
  store: MirrorStore;
  transport: MirrorTransport;
  limit?: number;
  timeoutMs?: number;
  liveMode?: boolean;
}): Promise<RunResult> {
  const res: RunResult = {
    enabled: gatesOpen(opts.gates),
    done: 0,
    pending: 0,
    unknown: 0,
    review: 0,
    retry: 0,
    leaseLost: 0,
  };
  if (!res.enabled) return res; // no DB, no fetch
  const env = {
    store: opts.store,
    t: opts.transport,
    ms: opts.timeoutMs ?? 10_000,
    live: opts.liveMode ?? false,
    res,
    allowDraft: opts.gates.draftHomologated,
  };
  const rows = await opts.store.claim(opts.limit ?? 20);
  for (const row of rows) {
    try {
      await processRow(row, env);
    } catch {
      res.unknown++;
    } // lease expiry recovers it as a_conciliar in SQL
  }
  return res;
}

type Env = {
  store: MirrorStore;
  t: MirrorTransport;
  ms: number;
  live: boolean;
  res: RunResult;
  allowDraft: boolean;
};

async function set(
  env: Env,
  row: OutboxRow,
  state: RowState,
  reason: string | null,
  bucket: keyof Omit<RunResult, "enabled">,
  extra?: { ghlTransactionId?: string; retrySeconds?: number },
) {
  const ok = await env.store.setState(row, state, reason, extra);
  if (ok) env.res[bucket]++;
  else env.res.leaseLost++;
  return ok;
}

async function processRow(row: OutboxRow, env: Env) {
  const ctx = await env.store.loadContext(row); // reloaded under the project lock/lease
  if (!ctx) {
    env.res.leaseLost++;
    return;
  }
  const r = ctx.receipt;

  if (row.state === "fatura_a_conciliar") return reconcileInvoiceRow(row, ctx, env);
  if (row.state === "pagamento_a_conciliar") return reconcilePaymentRow(row, ctx, env);

  let contactInvoicesWithoutLink = 0;
  if (!ctx.link && r.ghlContactId) {
    let list: RemoteInvoice[];
    try {
      list = await withTimeout(env.ms, (s) =>
        env.t.listInvoicesByContact(r.ghlContactId as string, s),
      );
    } catch {
      await set(env, row, "pending", "leitura_falhou", "retry", { retrySeconds: RETRY_SECONDS });
      return;
    }
    if (ctx.project && list.some((i) => i.marker === projectMarker(ctx.project!.id))) {
      // Our marker already exists remotely without a local link → reconcile, never create a second one.
      await set(env, row, "fatura_a_conciliar", "marcador_sem_vinculo", "unknown");
      return;
    }
    contactInvoicesWithoutLink = list.length;
  }

  const plan = planInvoice({
    receipt: r,
    project: ctx.project,
    link: ctx.link,
    contact: ctx.contact,
    studio: ctx.studio,
    contactInvoicesWithoutLink,
    liveMode: env.live,
  });
  if (plan.kind === "pending") {
    await set(env, row, "pending", plan.reason, "pending");
    return;
  }

  let invoiceId: string;
  if (plan.kind === "create") {
    if (!(await env.store.markInFlight(row, "create"))) {
      env.res.leaseLost++;
      return;
    }
    let out: HttpResult<{ invoiceId: string }>;
    try {
      out = await withTimeout(env.ms, (s) => env.t.createInvoice(plan.body, s));
    } catch {
      await set(env, row, "fatura_a_conciliar", "resultado_desconhecido", "unknown");
      return;
    }
    if (out.kind !== "ok") {
      await postFailure(env, row, out, "fatura_a_conciliar");
      return;
    }
    if (!(await env.store.saveLink(row, out.value.invoiceId))) {
      await set(env, row, "fatura_a_conciliar", "vinculo_nao_salvo", "unknown");
      return;
    }
    invoiceId = out.value.invoiceId;
  } else invoiceId = plan.invoiceId;

  await recordStep(row, ctx, invoiceId, env);
}

async function postFailure(
  env: Env,
  row: OutboxRow,
  out: { kind: "http" | "invalid"; status: number },
  uncertain: RowState,
) {
  if (out.kind === "http" && out.status === 403) {
    await set(env, row, "revisao", "sem_permissao", "review");
    return;
  }
  if (out.kind === "http" && DEFINITIVE_REJECT.has(out.status)) {
    await set(env, row, "revisao", `http_${out.status}`, "review");
    return;
  }
  // 408/429/5xx/invalid body: may have been applied → reconcile, never resend.
  await set(
    env,
    row,
    uncertain,
    out.kind === "invalid" ? "resposta_invalida" : `http_${out.status}`,
    "unknown",
  );
}

async function recordStep(row: OutboxRow, ctx: MirrorContext, invoiceId: string, env: Env) {
  const r = ctx.receipt;
  if (!ctx.project) {
    await set(env, row, "pending", "projeto_ausente", "pending");
    return;
  }
  let g: HttpResult<RemoteInvoice>;
  try {
    g = await withTimeout(env.ms, (s) => env.t.getInvoice(invoiceId, s));
  } catch {
    await set(env, row, "pending", "leitura_falhou", "retry", { retrySeconds: RETRY_SECONDS });
    return;
  }
  if (g.kind !== "ok") {
    if (g.kind === "http" && g.status === 403) {
      await set(env, row, "revisao", "sem_permissao", "review");
      return;
    }
    await set(
      env,
      row,
      "pending",
      g.kind === "invalid" ? "resposta_invalida" : `http_${g.status}`,
      "retry",
      { retrySeconds: RETRY_SECONDS },
    );
    return;
  }
  const pp = planPayment(r, g.value, ctx.project, {
    liveMode: env.live,
    allowDraft: env.allowDraft,
  });
  if (pp.kind === "pending") {
    await set(env, row, "revisao", pp.reason, "review");
    return;
  }
  if (!(await env.store.markInFlight(row, "record"))) {
    env.res.leaseLost++;
    return;
  }
  let out: HttpResult<{ success: boolean }>;
  try {
    out = await withTimeout(env.ms, (s) => env.t.recordPayment(invoiceId, pp.body, s));
  } catch {
    await set(env, row, "pagamento_a_conciliar", "resultado_desconhecido", "unknown");
    return;
  }
  if (out.kind !== "ok" || !out.value.success) {
    if (out.kind === "ok") {
      await set(env, row, "pagamento_a_conciliar", "sucesso_nao_confirmado", "unknown");
      return;
    }
    await postFailure(env, row, out, "pagamento_a_conciliar");
    return;
  }
  await verifyPayment(row, r, invoiceId, env);
}

async function verifyPayment(row: OutboxRow, r: Receipt, invoiceId: string, env: Env) {
  let txs: RemoteTransaction[];
  try {
    txs = await withTimeout(env.ms, (s) => env.t.listTransactionsByInvoice(invoiceId, s));
  } catch {
    await set(env, row, "pagamento_a_conciliar", "readback_falhou", "unknown");
    return;
  }
  const rec = reconcilePayment(txs, r, invoiceId, env.live);
  if (rec.kind === "pending") {
    await set(env, row, "pagamento_a_conciliar", rec.reason, "unknown");
    return;
  }
  await set(env, row, "concluido", null, "done", { ghlTransactionId: rec.value.id });
}

async function reconcileInvoiceRow(row: OutboxRow, ctx: MirrorContext, env: Env) {
  const r = ctx.receipt;
  if (!ctx.project || !r.ghlContactId) {
    await set(env, row, "revisao", "contexto_incompleto", "review");
    return;
  }
  if (ctx.link) {
    await recordStep(row, ctx, ctx.link.invoiceId, env);
    return;
  }
  let list: RemoteInvoice[];
  try {
    list = await withTimeout(env.ms, (s) =>
      env.t.listInvoicesByContact(r.ghlContactId as string, s),
    );
  } catch {
    await set(env, row, "fatura_a_conciliar", "leitura_falhou", "unknown");
    return;
  }
  const rec = reconcileInvoice(list, ctx.project, r.ghlContactId);
  if (rec.kind === "pending") {
    await set(env, row, "fatura_a_conciliar", rec.reason, "unknown");
    return;
  }
  if (!(await env.store.saveLink(row, rec.value.id))) {
    await set(env, row, "revisao", "vinculo_concorrente", "review");
    return;
  }
  await set(env, row, "pending", "fatura_conciliada", "pending");
}

async function reconcilePaymentRow(row: OutboxRow, ctx: MirrorContext, env: Env) {
  if (!ctx.link) {
    await set(env, row, "revisao", "sem_vinculo_fatura", "review");
    return;
  }
  await verifyPayment(row, ctx.receipt, ctx.link.invoiceId, env);
}

export function readActivationGates(): ActivationGates {
  return {
    flag: process.env["PAYMENT_MIRROR_ENABLED"] === "true",
    scopesVerified: process.env["PAYMENT_MIRROR_SCOPES_VERIFIED"] === "true",
    contractVerified: process.env["PAYMENT_MIRROR_CONTRACT_VERIFIED"] === "true",
    workflowsReviewed: process.env["PAYMENT_MIRROR_WORKFLOWS_REVIEWED"] === "true",
    draftHomologated: process.env["PAYMENT_MIRROR_DRAFT_HOMOLOGATED"] === "true",
  };
}
export const isPaymentMirrorEnabled = () => gatesOpen(readActivationGates());
export { GF_LOCATION_ID };
