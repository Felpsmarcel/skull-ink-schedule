import { describe, it, expect } from "vitest";
import {
  GF_LOCATION_ID, authorizeConfirmation, canonicalReceiptCount, centsToApiAmount, planInvoice, planPayment,
  planRefund, projectMarker, receiptFingerprint, receiptMarker, reconcileInvoice, reconcilePayment, registerInLedger,
  type Contact, type InvoiceLink, type LedgerEntry, type Project, type Receipt, type RemoteInvoice,
} from "@/lib/payment-mirror-core";
import { runPaymentMirror, type MirrorStore, type MirrorTransport, type OutboxRow, type RowState } from "@/lib/payment-mirror.server";

const OPEN = { flag: true, scopesVerified: true, contractVerified: true, workflowsReviewed: true };
const rc = (o: Partial<Receipt> = {}): Receipt => ({
  receiptId: "rcp-1", sources: [{ source: "movimentacao", sourceId: "m-1" }], confirmed: true, amountCents: 15000,
  currency: "EUR", paidOn: "2026-10-05", method: "dinheiro", locationId: GF_LOCATION_ID, ghlContactId: "c-A", projectId: "p-1", ...o,
});
const pj = (o: Partial<Project> = {}): Project => ({ id: "p-1", locationId: GF_LOCATION_ID, ghlContactId: "c-A", ghlOpportunityId: "o-1", title: "Braço", approvedTotalCents: 60000, ...o });
const ct = (o: Partial<Contact> = {}): Contact => ({ id: "c-A", locationId: GF_LOCATION_ID, name: "Cliente Teste", email: null, phone: null, ...o });
const studio = { name: "GF Tattoo", address: null };
const inv = (o: Partial<RemoteInvoice> = {}): RemoteInvoice => ({ id: "inv-1", altId: GF_LOCATION_ID, contactId: "c-A", currency: "EUR", status: "sent", totalCents: 60000, amountDueCents: 60000, marker: projectMarker("p-1"), ...o });

describe("core rules", () => {
  it("EUR 1,23 boundary conversion keeps cents internally", () => {
    expect(centsToApiAmount(123)).toBe(1.23);
    expect(() => centsToApiAmount(1.5)).toThrow();
  });
  it("confirmation: only authenticated admin", () => {
    expect(authorizeConfirmation({ authenticated: false, role: null })).toBe(false);
    expect(authorizeConfirmation({ authenticated: true, role: "artist" })).toBe(false);
    expect(authorizeConfirmation({ authenticated: true, role: "x" })).toBe(false);
    expect(authorizeConfirmation({ authenticated: true, role: "admin" })).toBe(true);
  });
  it("unconfirmed stays pending", () => {
    expect(planInvoice({ receipt: rc({ confirmed: false }), project: pj(), link: null, contact: ct(), studio })).toEqual({ kind: "pending", reason: "nao_confirmado" });
  });
  it("rejects declared project mismatch and foreign/ambiguous links", () => {
    expect(planInvoice({ receipt: rc({ declaredProjectId: "p-2" }), project: pj(), link: null, contact: ct(), studio })).toMatchObject({ reason: "projeto_divergente" });
    expect(planInvoice({ receipt: rc(), project: pj({ ghlContactId: "c-B" }), link: null, contact: ct(), studio })).toMatchObject({ reason: "contato_divergente" });
    expect(planInvoice({ receipt: rc(), project: pj(), link: null, contact: ct(), studio, contactInvoicesWithoutLink: 1 })).toMatchObject({ reason: "fatura_existente_sem_vinculo" });
    expect(planInvoice({ receipt: rc({ projectId: null }), project: null, link: null, contact: ct(), studio })).toMatchObject({ reason: "projeto_ausente" });
  });
  it("missing project total or contact/studio data stays pending, nothing invented", () => {
    expect(planInvoice({ receipt: rc(), project: pj({ approvedTotalCents: null }), link: null, contact: ct(), studio })).toMatchObject({ reason: "valor_projeto_ausente" });
    expect(planInvoice({ receipt: rc(), project: pj(), link: null, contact: ct({ name: null }), studio })).toMatchObject({ reason: "dados_contato_ausentes" });
    expect(planInvoice({ receipt: rc(), project: pj(), link: null, contact: ct(), studio: { name: null, address: null } })).toMatchObject({ reason: "dados_estudio_ausentes" });
    const p = planInvoice({ receipt: rc(), project: pj(), link: null, contact: ct(), studio });
    if (p.kind !== "create") throw new Error();
    expect(p.body.contactDetails).toEqual({ id: "c-A", name: "Cliente Teste" });
    expect(p.body.items[0].amount).toBe(600);
  });
  it("existing verified link is reused", () => {
    const link: InvoiceLink = { locationId: GF_LOCATION_ID, projectId: "p-1", invoiceId: "inv-9" };
    expect(planInvoice({ receipt: rc(), project: pj(), link, contact: ct(), studio })).toEqual({ kind: "use", invoiceId: "inv-9" });
  });
  it("payment body carries only the installment, never total or 35%", () => {
    const a = planPayment(rc({ amountCents: 15000 }), inv(), "p-1");
    const b = planPayment(rc({ receiptId: "rcp-2", amountCents: 20000 }), inv(), "p-1");
    if (a.kind !== "send" || b.kind !== "send") throw new Error();
    expect([a.body.amount, b.body.amount]).toEqual([150, 200]);
    expect(a.body.meta.externalId).toBe(receiptMarker("rcp-1"));
    expect(a.body).not.toHaveProperty("card");
  });
  it("invoice verification before POST", () => {
    expect(planPayment(rc(), inv({ altId: "other" }), "p-1")).toMatchObject({ reason: "fatura_location_estrangeira" });
    expect(planPayment(rc(), inv({ currency: "BRL" }), "p-1")).toMatchObject({ reason: "fatura_moeda_divergente" });
    expect(planPayment(rc(), inv({ amountDueCents: 100 }), "p-1")).toMatchObject({ reason: "saldo_insuficiente" });
    expect(planPayment(rc(), inv({ marker: projectMarker("p-2") }), "p-1")).toMatchObject({ reason: "projeto_divergente" });
  });
  it("ledger replay vs conflicting payload", () => {
    const L = new Map<string, LedgerEntry>(); let n = 0; const id = () => `r${++n}`;
    const h = receiptFingerprint(rc());
    expect(registerInLedger(L, "k1", h, id)).toEqual({ kind: "new", receiptId: "r1" });
    expect(registerInLedger(L, "k1", h, id)).toEqual({ kind: "same", receiptId: "r1" });
    expect(registerInLedger(L, "k1", receiptFingerprint(rc({ amountCents: 1 })), id)).toEqual({ kind: "conflict" });
  });
  it("overlapping sources map to one receipt only with explicit mapping", () => {
    const m = { source: "movimentacao" as const, sourceId: "m1" }, p = { source: "payment" as const, sourceId: "p1" };
    expect(canonicalReceiptCount([m, p], [])).toBe(2);
    expect(canonicalReceiptCount([m, p], [[m, p]])).toBe(1);
  });
  it("reconciliation needs exactly one exact marker", () => {
    expect(reconcileInvoice([inv({ marker: null })], pj(), "c-A")).toMatchObject({ reason: "sem_marcador" });
    expect(reconcileInvoice([inv(), inv({ id: "inv-2" })], pj(), "c-A")).toMatchObject({ reason: "marcador_duplicado" });
    expect(reconcileInvoice([inv()], pj(), "c-A")).toMatchObject({ kind: "found" });
    const tx = { id: "t1", invoiceId: "inv-1", altId: GF_LOCATION_ID, contactId: "c-A", currency: "EUR", amountCents: 15000, marker: receiptMarker("rcp-1") };
    expect(reconcilePayment([{ ...tx, marker: null }], rc(), "inv-1")).toMatchObject({ reason: "sem_marcador" });
    expect(reconcilePayment([tx, { ...tx, id: "t2" }], rc(), "inv-1")).toMatchObject({ reason: "marcador_duplicado" });
    expect(reconcilePayment([tx], rc(), "inv-1")).toMatchObject({ kind: "found" });
  });
  it("refunds go to review and never exceed original", () => {
    const o = { receiptId: "rcp-1", amountCents: 15000, refundedCents: 10000 };
    expect(planRefund(o, { linkedReceiptId: "rcp-1", amountCents: 5000 })).toEqual({ kind: "review", amountCents: 5000 });
    expect(planRefund(o, { linkedReceiptId: "rcp-1", amountCents: 5001 })).toMatchObject({ reason: "excede_original" });
    expect(planRefund(o, { linkedReceiptId: "x", amountCents: 1 })).toMatchObject({ reason: "sem_vinculo" });
  });
});

// ---------- worker with fakes ----------
function harness(opts: { rows: OutboxRow[]; projects?: Record<string, Project>; links?: Map<string, InvoiceLink>; transport?: Partial<MirrorTransport>; leaseLost?: boolean }) {
  const links = opts.links ?? new Map<string, InvoiceLink>();
  const log: string[] = []; const calls: string[] = []; let invSeq = 0;
  const projects = opts.projects ?? { "p-1": pj() };
  const store: MirrorStore = {
    claim: async () => opts.rows,
    lockProject: async () => true,
    loadContext: async (r) => ({ project: projects[r.receipt.projectId ?? ""] ?? null, link: links.get(r.receipt.projectId ?? "") ?? null, contact: ct({ id: r.receipt.ghlContactId ?? "" }), studio, contactInvoicesWithoutLink: 0 }),
    markInFlight: async (r, ph) => { log.push(`inflight:${r.id}:${ph}`); return !opts.leaseLost; },
    saveLink: async (_r, l) => { if (links.has(l.projectId)) return false; links.set(l.projectId, l); return true; },
    setState: async (r, s: RowState, why) => { log.push(`${r.id}:${s}:${why ?? ""}`); return true; },
  };
  const transport: MirrorTransport = {
    createInvoice: async (b) => { calls.push(`create:${b.termsNotes}`); return { status: 200, invoiceId: `inv-${++invSeq}` }; },
    getInvoice: async (id) => { calls.push(`get:${id}`); const pid = [...links.values()].find((l) => l.invoiceId === id)?.projectId ?? "p-1"; return { status: 200, invoice: inv({ id, marker: projectMarker(pid) }) }; },
    recordPayment: async (id, b) => { calls.push(`record:${id}:${b.amount}`); return { status: 200, transactionId: `tx-${b.meta.externalId}` }; },
    listInvoicesByContact: async () => [], listTransactionsByInvoice: async () => [],
    ...opts.transport,
  };
  return { store, transport, log, calls, links };
}
const row = (o: Partial<OutboxRow> = {}, r: Partial<Receipt> = {}): OutboxRow => ({ id: "o1", leaseToken: "L", attempts: 0, state: "pending", receipt: rc(r), ...o });

describe("worker", () => {
  it("disabled flag or any closed gate: no DB, no fetch", async () => {
    const boom = () => { throw new Error("touched"); };
    const store = { claim: boom } as unknown as MirrorStore;
    const transport = { createInvoice: boom } as unknown as MirrorTransport;
    expect((await runPaymentMirror({ gates: { ...OPEN, flag: false }, store, transport })).enabled).toBe(false);
    expect((await runPaymentMirror({ gates: { ...OPEN, scopesVerified: false }, store, transport })).enabled).toBe(false);
  });
  it("creates one invoice per project then records installments into it", async () => {
    const h = harness({ rows: [row({ id: "o1" }), row({ id: "o2" }, { receiptId: "rcp-2", amountCents: 20000 })] });
    const r = await runPaymentMirror({ gates: OPEN, store: h.store, transport: h.transport });
    expect(r.done).toBe(2);
    expect(h.calls.filter((c) => c.startsWith("create"))).toHaveLength(1);
    expect(h.calls.filter((c) => c.startsWith("record"))).toEqual(["record:inv-1:150", "record:inv-1:200"]);
    expect(h.calls.some((c) => c.includes("/send"))).toBe(false);
  });
  it("same client, distinct projects keep distinct invoices", async () => {
    const h = harness({ rows: [row({ id: "o1" }), row({ id: "o2" }, { receiptId: "rcp-2", projectId: "p-2" })], projects: { "p-1": pj(), "p-2": pj({ id: "p-2" }) } });
    await runPaymentMirror({ gates: OPEN, store: h.store, transport: h.transport });
    expect(h.links.get("p-1")?.invoiceId).not.toBe(h.links.get("p-2")?.invoiceId);
  });
  it("concurrent link save loses → review, no payment", async () => {
    const links = new Map<string, InvoiceLink>();
    const h = harness({ rows: [row()], links });
    h.store.saveLink = async () => false;
    const r = await runPaymentMirror({ gates: OPEN, store: h.store, transport: h.transport });
    expect(r.review).toBe(1);
    expect(h.calls.some((c) => c.startsWith("record"))).toBe(false);
  });
  it("timeout on create → fatura_a_conciliar, no resend", async () => {
    const h = harness({ rows: [row()], transport: { createInvoice: () => new Promise(() => {}) } });
    const r = await runPaymentMirror({ gates: OPEN, store: h.store, transport: h.transport, timeoutMs: 5 });
    expect(r.unknown).toBe(1);
    expect(h.log).toContain("o1:fatura_a_conciliar:resultado_desconhecido");
  });
  it("timeout on record → pagamento_a_conciliar; replay of that row only reconciles", async () => {
    const links = new Map([["p-1", { locationId: GF_LOCATION_ID, projectId: "p-1", invoiceId: "inv-1" }]]);
    const h = harness({ rows: [row()], links, transport: { recordPayment: () => new Promise(() => {}) } });
    await runPaymentMirror({ gates: OPEN, store: h.store, transport: h.transport, timeoutMs: 5 });
    expect(h.log).toContain("o1:pagamento_a_conciliar:resultado_desconhecido");
    const h2 = harness({ rows: [row({ state: "pagamento_a_conciliar" })], links });
    const r2 = await runPaymentMirror({ gates: OPEN, store: h2.store, transport: h2.transport });
    expect(h2.calls.some((c) => c.startsWith("record"))).toBe(false);
    expect(r2.unknown).toBe(1); // no marker found → stays pending review
  });
  it("lease lost before POST → nothing sent", async () => {
    const h = harness({ rows: [row()], leaseLost: true });
    await runPaymentMirror({ gates: OPEN, store: h.store, transport: h.transport });
    expect(h.calls).toHaveLength(0);
  });
  it("lease lost after POST (crash) is not counted as done", async () => {
    const links = new Map([["p-1", { locationId: GF_LOCATION_ID, projectId: "p-1", invoiceId: "inv-1" }]]);
    const h = harness({ rows: [row()], links });
    h.store.setState = async () => false;
    const r = await runPaymentMirror({ gates: OPEN, store: h.store, transport: h.transport });
    expect(r.done).toBe(0); expect(r.unknown).toBe(1);
  });
  it("HTTP 403 → review; 429 → retry", async () => {
    const h = harness({ rows: [row()], transport: { createInvoice: async () => ({ status: 403, invoiceId: null }) } });
    expect((await runPaymentMirror({ gates: OPEN, store: h.store, transport: h.transport })).review).toBe(1);
    const h2 = harness({ rows: [row()], transport: { createInvoice: async () => ({ status: 429, invoiceId: null }) } });
    expect((await runPaymentMirror({ gates: OPEN, store: h2.store, transport: h2.transport })).retry).toBe(1);
  });
  it("2xx without id is invalid response → a conciliar", async () => {
    const h = harness({ rows: [row()], transport: { createInvoice: async () => ({ status: 201, invoiceId: null }) } });
    expect((await runPaymentMirror({ gates: OPEN, store: h.store, transport: h.transport })).unknown).toBe(1);
  });
  it("reconcile duplicates stay pending", async () => {
    const h = harness({ rows: [row({ state: "fatura_a_conciliar" })], transport: { listInvoicesByContact: async () => [inv(), inv({ id: "inv-2" })] } });
    await runPaymentMirror({ gates: OPEN, store: h.store, transport: h.transport });
    expect(h.log).toContain("o1:fatura_a_conciliar:marcador_duplicado");
  });
  it("fake project link (other contact) never creates", async () => {
    const h = harness({ rows: [row({}, { ghlContactId: "c-B" })] });
    await runPaymentMirror({ gates: OPEN, store: h.store, transport: h.transport });
    expect(h.calls).toHaveLength(0);
    expect(h.log).toContain("o1:pending:contato_divergente");
  });
});
