// Pure rules for mirroring confirmed receipts into GHL Invoices.
// No I/O. Money is integer euro cents; conversion to API units only at the boundary.
// One invoice per immutable project id; each manual payment carries only its installment.

export const GF_LOCATION_ID = "9iqrKUVPDddINb9S4Iwd";
// Explicit version for the NEW adapter only; legacy bridges keep their own header.
// Reviewer reports v3 as the current primary contract for Invoices; homologation gate stays closed until verified.
export const GHL_INVOICES_API_VERSION = "v3";

export type MirrorSource = "movimentacao" | "payment" | "booking_deposit";
export type LocalMethod =
  | "cartao" | "dinheiro" | "sumup" | "transferencia"
  | "card" | "cash" | "transfer" | "payconiq" | "other";
export type GhlMode = "card" | "cash" | "bank_transfer" | "other";

export interface SourceRef { source: MirrorSource; sourceId: string }

/** Canonical receipt: stable identity independent of which table(s) recorded it. */
export interface Receipt {
  receiptId: string;
  sources: SourceRef[];
  confirmed: boolean; // only set by authenticated admin confirmation
  amountCents: number; // installment actually received
  currency: string;
  paidOn: string; // YYYY-MM-DD
  method: LocalMethod;
  locationId: string;
  ghlContactId: string | null;
  projectId: string | null;
  declaredProjectId?: string | null; // project id sent by the caller, must match
}

export interface Project {
  id: string;
  locationId: string;
  ghlContactId: string | null;
  ghlOpportunityId: string | null;
  title: string;
  approvedTotalCents: number | null; // documented/approved full value
}

export interface Contact { id: string; locationId: string; name: string | null; email: string | null; phone: string | null }

export interface StudioDetails { name: string | null; address: string | null }

export interface InvoiceLink { locationId: string; projectId: string; invoiceId: string }

export interface RemoteInvoice {
  id: string;
  altId: string;
  contactId: string | null;
  currency: string;
  status: string;
  totalCents: number;
  amountDueCents: number;
  marker: string | null; // text found in name/termsNotes
  liveMode: boolean;
}

export type Pending =
  | "nao_confirmado" | "id_ausente" | "valor_invalido" | "moeda_invalida" | "data_invalida"
  | "location_estrangeira" | "contato_ausente" | "projeto_ausente" | "projeto_divergente"
  | "contato_divergente" | "valor_projeto_ausente" | "dados_contato_ausentes" | "dados_estudio_ausentes"
  | "fatura_location_estrangeira" | "fatura_contato_divergente" | "fatura_moeda_divergente"
  | "fatura_status_invalido" | "saldo_insuficiente" | "fatura_existente_sem_vinculo"
  | "valor_projeto_divergente" | "modo_divergente";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Calendar-valid YYYY-MM-DD (rejects 2026-99-99, 2026-02-30). */
export function isCalendarDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export const projectMarker = (projectId: string) => `gf-project:${projectId}`;
export const receiptMarker = (receiptId: string) => `gf-receipt:${receiptId}`;

/** API amount: number with unit not stated by GHL docs. Hypothesis: euros. Homologate with EUR 1,23. */
export function centsToApiAmount(cents: number): number {
  if (!Number.isInteger(cents)) throw new Error("cents_not_integer");
  return Math.round(cents) / 100;
}

export function mapMethod(m: LocalMethod): GhlMode {
  switch (m) {
    case "cartao": case "sumup": case "card": return "card";
    case "dinheiro": case "cash": return "cash";
    case "transferencia": case "transfer": return "bank_transfer";
    default: return "other";
  }
}

/** Only an authenticated admin may confirm; public links, artists and unknown roles stay "informado". */
export function authorizeConfirmation(ctx: { authenticated: boolean; role: string | null }): boolean {
  return ctx.authenticated === true && ctx.role === "admin";
}

export function validateReceipt(r: Receipt, project: Project | null): Pending | null {
  if (!r.confirmed) return "nao_confirmado";
  if (!r.receiptId || r.sources.length === 0) return "id_ausente";
  if (!Number.isInteger(r.amountCents) || r.amountCents <= 0) return "valor_invalido";
  if (r.currency !== "EUR") return "moeda_invalida";
  if (!isCalendarDate(r.paidOn)) return "data_invalida";
  if (r.locationId !== GF_LOCATION_ID) return "location_estrangeira";
  if (!r.ghlContactId) return "contato_ausente";
  if (!r.projectId || !project) return "projeto_ausente";
  if (r.declaredProjectId != null && r.declaredProjectId !== r.projectId) return "projeto_divergente";
  if (project.id !== r.projectId) return "projeto_divergente";
  if (project.locationId !== GF_LOCATION_ID) return "location_estrangeira";
  if (project.ghlContactId !== r.ghlContactId) return "contato_divergente";
  return null;
}

export interface CreateInvoiceBody {
  altId: string;
  altType: "location";
  name: string;
  title: string;
  currency: "EUR";
  contactDetails: { id: string; name: string; email?: string; phoneNo?: string };
  businessDetails: { name: string; address?: string };
  items: Array<{ name: string; amount: number; qty: 1; currency: "EUR" }>;
  issueDate: string;
  termsNotes: string;
  // Required by the published Create Invoice schema. Zero discount = none applied (not invented).
  discount: { value: 0; type: "percentage" };
  liveMode: boolean;
  // Required field; empty recipients = hypothesis to homologate. Creation is separate from /send, never called.
  sentTo: { email: string[]; phoneNo: string[] };
}

export type InvoicePlan =
  | { kind: "use"; invoiceId: string }
  | { kind: "create"; body: CreateInvoiceBody; marker: string }
  | { kind: "pending"; reason: Pending };

/**
 * Decide which invoice a receipt goes to. Uses the verified (location, project) link when present.
 * Remote invoices found for the contact without an exact project link are NOT auto-selected.
 */
export function planInvoice(args: {
  receipt: Receipt; project: Project | null; link: InvoiceLink | null;
  contact: Contact | null; studio: StudioDetails | null; contactInvoicesWithoutLink?: number; liveMode?: boolean;
}): InvoicePlan {
  const { receipt: r, project: p, link, contact, studio } = args;
  const bad = validateReceipt(r, p);
  if (bad) return { kind: "pending", reason: bad };
  const project = p as Project;
  if (link) {
    if (link.locationId !== GF_LOCATION_ID || link.projectId !== project.id) return { kind: "pending", reason: "projeto_divergente" };
    return { kind: "use", invoiceId: link.invoiceId };
  }
  if ((args.contactInvoicesWithoutLink ?? 0) > 0) return { kind: "pending", reason: "fatura_existente_sem_vinculo" };
  if (project.approvedTotalCents == null || !Number.isInteger(project.approvedTotalCents) || project.approvedTotalCents <= 0)
    return { kind: "pending", reason: "valor_projeto_ausente" };
  if (!contact || contact.id !== r.ghlContactId || contact.locationId !== GF_LOCATION_ID) return { kind: "pending", reason: "contato_divergente" };
  if (!contact.name) return { kind: "pending", reason: "dados_contato_ausentes" };
  if (!studio?.name) return { kind: "pending", reason: "dados_estudio_ausentes" };
  const marker = projectMarker(project.id);
  const contactDetails: CreateInvoiceBody["contactDetails"] = { id: contact.id, name: contact.name };
  if (contact.email) contactDetails.email = contact.email;
  if (contact.phone) contactDetails.phoneNo = contact.phone;
  const businessDetails: CreateInvoiceBody["businessDetails"] = { name: studio.name };
  if (studio.address) businessDetails.address = studio.address;
  return {
    kind: "create",
    marker,
    body: {
      altId: GF_LOCATION_ID, altType: "location",
      name: `${project.title} [${marker}]`, title: "Fatura", currency: "EUR",
      contactDetails, businessDetails,
      items: [{ name: project.title, amount: centsToApiAmount(project.approvedTotalCents), qty: 1, currency: "EUR" }],
      issueDate: r.paidOn,
      termsNotes: marker,
      discount: { value: 0, type: "percentage" },
      liveMode: args.liveMode ?? false,
      sentTo: { email: [], phoneNo: [] },
    },
  };
}

export interface RecordPaymentBody {
  altId: string;
  altType: "location";
  mode: GhlMode;
  amount: number;
  notes: string;
  meta: { externalId: string };
  // card/cheque are marked required in the published schema even for cash; we never invent values.
}

export type PaymentPlan = { kind: "send"; body: RecordPaymentBody } | { kind: "pending"; reason: Pending };

/** Verify the GET-ed invoice before POST and build the installment-only body. */
export function planPayment(r: Receipt, inv: RemoteInvoice, project: Project, opts: { liveMode: boolean; allowDraft: boolean }): PaymentPlan {
  const projectId = project.id;
  if (inv.altId !== GF_LOCATION_ID) return { kind: "pending", reason: "fatura_location_estrangeira" };
  if (inv.contactId !== r.ghlContactId) return { kind: "pending", reason: "fatura_contato_divergente" };
  if (inv.currency !== "EUR") return { kind: "pending", reason: "fatura_moeda_divergente" };
  if (inv.liveMode !== opts.liveMode) return { kind: "pending", reason: "modo_divergente" };
  // Draft = created without /send. Paying it is allowed only once the draft flow is homologated.
  if (["void", "paid"].includes(inv.status) || (inv.status === "draft" && !opts.allowDraft)) return { kind: "pending", reason: "fatura_status_invalido" };
  if (project.approvedTotalCents == null || inv.totalCents !== project.approvedTotalCents) return { kind: "pending", reason: "valor_projeto_divergente" };
  if (inv.marker !== projectMarker(projectId)) return { kind: "pending", reason: "projeto_divergente" };
  if (inv.amountDueCents < r.amountCents) return { kind: "pending", reason: "saldo_insuficiente" };
  return {
    kind: "send",
    body: {
      altId: GF_LOCATION_ID, altType: "location", mode: mapMethod(r.method),
      amount: centsToApiAmount(r.amountCents),
      notes: `${receiptMarker(r.receiptId)} ${r.paidOn}`,
      meta: { externalId: receiptMarker(r.receiptId) },
    },
  };
}

// ---------- Reconciliation (exact marker only) ----------

export type Reconcile<T> = { kind: "found"; value: T } | { kind: "pending"; reason: "sem_marcador" | "marcador_duplicado" | "divergente" };

export function reconcileInvoice(cands: RemoteInvoice[], project: Project, contactId: string): Reconcile<RemoteInvoice> {
  const m = projectMarker(project.id);
  const exact = cands.filter((c) => c.marker === m);
  if (exact.length === 0) return { kind: "pending", reason: "sem_marcador" };
  if (exact.length > 1) return { kind: "pending", reason: "marcador_duplicado" };
  const c = exact[0];
  if (c.altId !== GF_LOCATION_ID || c.contactId !== contactId || c.currency !== "EUR" || c.totalCents !== project.approvedTotalCents)
    return { kind: "pending", reason: "divergente" };
  return { kind: "found", value: c };
}

/** marker = meta.externalId on both the record-payment body and the readback. */
export interface RemoteTransaction { id: string; invoiceId: string | null; altId: string; contactId: string | null; currency: string; amountCents: number; marker: string | null; status: string; liveMode: boolean; mode: GhlMode | string }
const TX_OK = new Set(["succeeded", "paid", "success"]);

export function reconcilePayment(txs: RemoteTransaction[], r: Receipt, invoiceId: string, liveMode = false): Reconcile<RemoteTransaction> {
  const m = receiptMarker(r.receiptId);
  const exact = txs.filter((t) => t.marker === m);
  if (exact.length === 0) return { kind: "pending", reason: "sem_marcador" };
  if (exact.length > 1) return { kind: "pending", reason: "marcador_duplicado" };
  const t = exact[0];
  if (t.invoiceId !== invoiceId || t.altId !== GF_LOCATION_ID || t.contactId !== r.ghlContactId || t.currency !== "EUR" || t.amountCents !== r.amountCents
    || !TX_OK.has(t.status) || t.liveMode !== liveMode || t.mode !== mapMethod(r.method))
    return { kind: "pending", reason: "divergente" };
  return { kind: "found", value: t };
}

// ---------- Ledger identity ----------

export interface LedgerEntry { key: string; payloadHash: string; receiptId: string }
export type LedgerResult = { kind: "new" | "same"; receiptId: string } | { kind: "conflict" };

/** Same key + same payload returns the same receipt; same key with different payload is a conflict. */
export function registerInLedger(ledger: Map<string, LedgerEntry>, key: string, payloadHash: string, newId: () => string): LedgerResult {
  const e = ledger.get(key);
  if (e) return e.payloadHash === payloadHash ? { kind: "same", receiptId: e.receiptId } : { kind: "conflict" };
  const receiptId = newId();
  ledger.set(key, { key, payloadHash, receiptId });
  return { kind: "new", receiptId };
}

/** Deterministic payload fingerprint (no personal data). */
export function receiptFingerprint(r: Pick<Receipt, "amountCents" | "currency" | "paidOn" | "method" | "projectId" | "ghlContactId">): string {
  return [r.amountCents, r.currency, r.paidOn, mapMethod(r.method), r.projectId ?? "", r.ghlContactId ?? ""].join("|");
}

/**
 * Explicit mapping: payments and movimentacoes rows representing the SAME event are merged
 * only through a documented map; never summed as independent revenue without proof.
 */
export function canonicalReceiptCount(sources: SourceRef[], sameEventMap: Array<[SourceRef, SourceRef]>): number {
  const k = (s: SourceRef) => `${s.source}:${s.sourceId}`;
  const parent = new Map<string, string>();
  const find = (x: string): string => { const p = parent.get(x) ?? x; return p === x ? x : find(p); };
  for (const s of sources) parent.set(k(s), k(s));
  for (const [a, b] of sameEventMap) { if (parent.has(k(a)) && parent.has(k(b))) parent.set(find(k(a)), find(k(b))); }
  return new Set(sources.map((s) => find(k(s)))).size;
}

// ---------- Corrections / refunds ----------

export type RefundPlan = { kind: "review"; amountCents: number } | { kind: "reject"; reason: "sem_vinculo" | "excede_original" | "valor_invalido" };

/** Refunds of mirrored payments always go to manual review; never auto-emitted, never history edits. */
export function planRefund(original: { receiptId: string; amountCents: number; refundedCents: number } | null,
  refund: { linkedReceiptId: string | null; amountCents: number }): RefundPlan {
  if (!original || refund.linkedReceiptId !== original.receiptId) return { kind: "reject", reason: "sem_vinculo" };
  if (!Number.isInteger(refund.amountCents) || refund.amountCents <= 0) return { kind: "reject", reason: "valor_invalido" };
  if (original.refundedCents + refund.amountCents > original.amountCents) return { kind: "reject", reason: "excede_original" };
  return { kind: "review", amountCents: refund.amountCents };
}

export interface ActivationGates { flag: boolean; scopesVerified: boolean; contractVerified: boolean; workflowsReviewed: boolean; draftHomologated: boolean }
export const gatesOpen = (g: ActivationGates) => g.flag && g.scopesVerified && g.contractVerified && g.workflowsReviewed && g.draftHomologated;
