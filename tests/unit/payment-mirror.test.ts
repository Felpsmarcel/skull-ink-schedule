import { describe, it, expect } from "vitest";
import {
  GF_LOCATION_ID, authorizeConfirmation, canonicalReceiptCount, centsToApiAmount, isCalendarDate, planInvoice, planPayment,
  planRefund, projectMarker, receiptFingerprint, receiptMarker, reconcileInvoice, reconcilePayment, registerInLedger,
  type Contact, type InvoiceLink, type LedgerEntry, type Project, type Receipt, type RemoteInvoice, type RemoteTransaction,
} from "@/lib/payment-mirror-core";
import { runPaymentMirror, type HttpResult, type MirrorContext, type MirrorStore, type MirrorTransport, type OutboxRow, type RowState } from "@/lib/payment-mirror.server";
import { createHttpMirrorTransport } from "@/lib/payment-mirror-transport.server";
import { createSupabaseMirrorStore } from "@/lib/payment-mirror-store.server";
import { handleMirrorRun } from "@/lib/payment-mirror-run.server";
import { afterReceiptRecorded } from "@/lib/payment-mirror-hook.server";

const OPEN = { flag: true, scopesVerified: true, contractVerified: true, workflowsReviewed: true, draftHomologated: true };
const CLOSED = { ...OPEN, flag: false };
const rc = (o: Partial<Receipt> = {}): Receipt => ({
  receiptId: "rcp-1", sources: [{ source: "movimentacao", sourceId: "m-1" }], confirmed: true, amountCents: 15000,
  currency: "EUR", paidOn: "2026-10-05", method: "dinheiro", locationId: GF_LOCATION_ID, ghlContactId: "c-A", projectId: "p-1", ...o,
});
const pj = (o: Partial<Project> = {}): Project => ({ id: "p-1", locationId: GF_LOCATION_ID, ghlContactId: "c-A", ghlOpportunityId: "o-1", title: "Braço", approvedTotalCents: 60000, ...o });
const ct = (o: Partial<Contact> = {}): Contact => ({ id: "c-A", locationId: GF_LOCATION_ID, name: "Cliente Teste", email: null, phone: null, ...o });
const studio = { name: "GF Tattoo", address: null };
// Draft = created without /send (official create returns draft).
const inv = (o: Partial<RemoteInvoice> = {}): RemoteInvoice => ({ id: "inv-1", altId: GF_LOCATION_ID, contactId: "c-A", currency: "EUR", status: "draft", totalCents: 60000, amountDueCents: 60000, marker: projectMarker("p-1"), liveMode: false, ...o });
const tx = (o: Partial<RemoteTransaction> = {}): RemoteTransaction => ({ id: "t1", invoiceId: "inv-1", altId: GF_LOCATION_ID, contactId: "c-A", currency: "EUR", amountCents: 15000, marker: receiptMarker("rcp-1"), status: "succeeded", liveMode: false, mode: "cash", ...o });
const PAY_OPTS = { liveMode: false, allowDraft: true };

describe("core rules", () => {
  it("EUR 1,23 boundary conversion and calendar dates", () => {
    expect(centsToApiAmount(123)).toBe(1.23);
    expect(() => centsToApiAmount(1.5)).toThrow();
    expect(isCalendarDate("2026-99-99")).toBe(false);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2026-10-31")).toBe(true);
    expect(planInvoice({ receipt: rc({ paidOn: "2026-99-99" }), project: pj(), link: null, contact: ct(), studio })).toMatchObject({ reason: "data_invalida" });
  });
  it("confirmation: only authenticated admin", () => {
    expect(authorizeConfirmation({ authenticated: false, role: null })).toBe(false);
    expect(authorizeConfirmation({ authenticated: true, role: "artist" })).toBe(false);
    expect(authorizeConfirmation({ authenticated: true, role: "x" })).toBe(false);
    expect(authorizeConfirmation({ authenticated: true, role: "admin" })).toBe(true);
  });
  it("rejects declared project mismatch, foreign contact and unlinked candidates", () => {
    expect(planInvoice({ receipt: rc({ declaredProjectId: "p-2" }), project: pj(), link: null, contact: ct(), studio })).toMatchObject({ reason: "projeto_divergente" });
    expect(planInvoice({ receipt: rc(), project: pj({ ghlContactId: "c-B" }), link: null, contact: ct(), studio })).toMatchObject({ reason: "contato_divergente" });
    expect(planInvoice({ receipt: rc(), project: pj(), link: null, contact: ct(), studio, contactInvoicesWithoutLink: 1 })).toMatchObject({ reason: "fatura_existente_sem_vinculo" });
  });
  it("create body: required discount/liveMode/sentTo present, no invented contact data", () => {
    expect(planInvoice({ receipt: rc(), project: pj({ approvedTotalCents: null }), link: null, contact: ct(), studio })).toMatchObject({ reason: "valor_projeto_ausente" });
    expect(planInvoice({ receipt: rc(), project: pj(), link: null, contact: ct(), studio: { name: null, address: null } })).toMatchObject({ reason: "dados_estudio_ausentes" });
    const p = planInvoice({ receipt: rc(), project: pj(), link: null, contact: ct(), studio });
    if (p.kind !== "create") throw new Error();
    expect(p.body.contactDetails).toEqual({ id: "c-A", name: "Cliente Teste" });
    expect(p.body).toMatchObject({ discount: { value: 0, type: "percentage" }, liveMode: false, sentTo: { email: [], phoneNo: [] } });
    expect(p.body.items[0].amount).toBe(600);
  });
  it("payment: installment only, draft allowed only when homologated, project total must match", () => {
    const a = planPayment(rc(), inv(), pj(), PAY_OPTS);
    if (a.kind !== "send") throw new Error();
    expect(a.body.amount).toBe(150);
    expect(a.body.meta.externalId).toBe(receiptMarker("rcp-1"));
    expect(a.body).not.toHaveProperty("card");
    expect(planPayment(rc(), inv(), pj(), { liveMode: false, allowDraft: false })).toMatchObject({ reason: "fatura_status_invalido" });
    expect(planPayment(rc(), inv({ totalCents: 50000 }), pj(), PAY_OPTS)).toMatchObject({ reason: "valor_projeto_divergente" });
    expect(planPayment(rc(), inv({ liveMode: true }), pj(), PAY_OPTS)).toMatchObject({ reason: "modo_divergente" });
    expect(planPayment(rc(), inv({ amountDueCents: 100 }), pj(), PAY_OPTS)).toMatchObject({ reason: "saldo_insuficiente" });
  });
  it("ledger replay vs conflicting payload; overlapping sources need mapping", () => {
    const L = new Map<string, LedgerEntry>(); let n = 0; const id = () => `r${++n}`;
    const h = receiptFingerprint(rc());
    expect(registerInLedger(L, "k1", h, id)).toEqual({ kind: "new", receiptId: "r1" });
    expect(registerInLedger(L, "k1", h, id)).toEqual({ kind: "same", receiptId: "r1" });
    expect(registerInLedger(L, "k1", receiptFingerprint(rc({ amountCents: 1 })), id)).toEqual({ kind: "conflict" });
    const m = { source: "movimentacao" as const, sourceId: "m1" }, p = { source: "payment" as const, sourceId: "p1" };
    expect(canonicalReceiptCount([m, p], [])).toBe(2);
    expect(canonicalReceiptCount([m, p], [[m, p]])).toBe(1);
  });
  it("reconciliation: exact marker + status/liveMode/mode", () => {
    expect(reconcileInvoice([inv({ marker: null })], pj(), "c-A")).toMatchObject({ reason: "sem_marcador" });
    expect(reconcileInvoice([inv(), inv({ id: "inv-2" })], pj(), "c-A")).toMatchObject({ reason: "marcador_duplicado" });
    expect(reconcilePayment([tx({ marker: null })], rc(), "inv-1")).toMatchObject({ reason: "sem_marcador" });
    expect(reconcilePayment([tx(), tx({ id: "t2" })], rc(), "inv-1")).toMatchObject({ reason: "marcador_duplicado" });
    expect(reconcilePayment([tx({ status: "failed" })], rc(), "inv-1")).toMatchObject({ reason: "divergente" });
    expect(reconcilePayment([tx({ mode: "card" })], rc(), "inv-1")).toMatchObject({ reason: "divergente" });
    expect(reconcilePayment([tx()], rc(), "inv-1")).toMatchObject({ kind: "found" });
  });
  it("refunds go to review and never exceed original", () => {
    const o = { receiptId: "rcp-1", amountCents: 15000, refundedCents: 10000 };
    expect(planRefund(o, { linkedReceiptId: "rcp-1", amountCents: 5000 })).toEqual({ kind: "review", amountCents: 5000 });
    expect(planRefund(o, { linkedReceiptId: "rcp-1", amountCents: 5001 })).toMatchObject({ reason: "excede_original" });
  });
});

// ---------- worker with doubles ----------
type H = ReturnType<typeof harness>;
function harness(opts: { rows: OutboxRow[]; projects?: Record<string, Project>; links?: Map<string, InvoiceLink>; transport?: Partial<MirrorTransport>; leaseLost?: boolean; stateFails?: boolean }) {
  const links = opts.links ?? new Map<string, InvoiceLink>();
  const log: string[] = []; const calls: string[] = []; let invSeq = 0;
  const projects = opts.projects ?? { "p-1": pj() };
  const remoteTx: RemoteTransaction[] = [];
  const store: MirrorStore = {
    claim: async () => opts.rows,
    loadContext: async (r): Promise<MirrorContext> => ({ receipt: r.receipt, project: projects[r.receipt.projectId ?? ""] ?? null, link: links.get(r.receipt.projectId ?? "") ?? null, contact: ct({ id: r.receipt.ghlContactId ?? "" }), studio }),
    markInFlight: async (r, ph) => { log.push(`inflight:${r.id}:${ph}`); return !opts.leaseLost; },
    saveLink: async (r, invoiceId) => { const pid = r.receipt.projectId!; const e = links.get(pid); if (e) return e.invoiceId === invoiceId; links.set(pid, { locationId: GF_LOCATION_ID, projectId: pid, invoiceId }); return true; },
    setState: async (r, s: RowState, why) => { log.push(`${r.id}:${s}:${why ?? ""}`); return !opts.stateFails; },
  };
  const ok = <T,>(value: T): HttpResult<T> => ({ kind: "ok", status: 200, value });
  const transport: MirrorTransport = {
    createInvoice: async (b) => { calls.push(`create:${b.termsNotes}`); return ok({ invoiceId: `inv-${++invSeq}` }); },
    getInvoice: async (id) => { calls.push(`get:${id}`); const pid = [...links.values()].find((l) => l.invoiceId === id)?.projectId ?? "p-1"; return ok(inv({ id, marker: projectMarker(pid), totalCents: projects[pid]?.approvedTotalCents ?? 0 })); },
    recordPayment: async (id, b) => { calls.push(`record:${id}:${b.amount}`); remoteTx.push(tx({ id: `t-${remoteTx.length}`, invoiceId: id, amountCents: Math.round(b.amount * 100), marker: b.meta.externalId, mode: b.mode })); return ok({ success: true }); },
    listInvoicesByContact: async () => [],
    listTransactionsByInvoice: async (id) => remoteTx.filter((t) => t.invoiceId === id),
    ...opts.transport,
  };
  return { store, transport, log, calls, links, remoteTx };
}
const row = (o: Partial<OutboxRow> = {}, r: Partial<Receipt> = {}): OutboxRow => ({ id: "o1", leaseToken: "L", attempts: 0, state: "pending", receipt: rc(r), ...o });
const run = (h: H, timeoutMs?: number) => runPaymentMirror({ gates: OPEN, store: h.store, transport: h.transport, timeoutMs });

describe("worker", () => {
  it("gates off: no DB, no fetch", async () => {
    const boom = () => { throw new Error("touched"); };
    const store = { claim: boom } as unknown as MirrorStore;
    expect((await runPaymentMirror({ gates: CLOSED, store, transport: {} as MirrorTransport })).enabled).toBe(false);
    expect((await runPaymentMirror({ gates: { ...OPEN, draftHomologated: false }, store, transport: {} as MirrorTransport })).enabled).toBe(false);
  });
  it("one invoice per project; installments recorded and verified by readback", async () => {
    const h = harness({ rows: [row({ id: "o1" }), row({ id: "o2" }, { receiptId: "rcp-2", amountCents: 20000 })] });
    const r = await run(h);
    expect(r.done).toBe(2);
    expect(h.calls.filter((c) => c.startsWith("create"))).toHaveLength(1);
    expect(h.calls.filter((c) => c.startsWith("record"))).toEqual(["record:inv-1:150", "record:inv-1:200"]);
  });
  it("success without exact readback stays a conciliar (no fabricated tx id)", async () => {
    const h = harness({ rows: [row()], transport: { listTransactionsByInvoice: async () => [] } });
    const r = await run(h);
    expect(r.done).toBe(0);
    expect(h.log).toContain("o1:pagamento_a_conciliar:sem_marcador");
  });
  it("HTTP 500 after create/record (possibly applied) → a conciliar, never resent", async () => {
    const h = harness({ rows: [row()], transport: { createInvoice: async () => ({ kind: "http", status: 500 }) } });
    await run(h);
    expect(h.log).toContain("o1:fatura_a_conciliar:http_500");
    const links = new Map([["p-1", { locationId: GF_LOCATION_ID, projectId: "p-1", invoiceId: "inv-1" }]]);
    let n = 0;
    const h2 = harness({ rows: [row()], links, transport: { recordPayment: async () => { n++; return { kind: "http", status: 500 }; } } });
    await run(h2);
    expect(n).toBe(1);
    expect(h2.log).toContain("o1:pagamento_a_conciliar:http_500");
    for (const s of [408, 429]) {
      const h3 = harness({ rows: [row()], links, transport: { recordPayment: async () => ({ kind: "http", status: s }) } });
      await run(h3);
      expect(h3.log).toContain(`o1:pagamento_a_conciliar:http_${s}`);
    }
  });
  it("403 → revisao sem_permissao", async () => {
    const h = harness({ rows: [row()], transport: { createInvoice: async () => ({ kind: "http", status: 403 }) } });
    await run(h);
    expect(h.log).toContain("o1:revisao:sem_permissao");
  });
  it("timeouts on create and record → a conciliar", async () => {
    const h = harness({ rows: [row()], transport: { createInvoice: () => new Promise(() => {}) } });
    await run(h, 5);
    expect(h.log).toContain("o1:fatura_a_conciliar:resultado_desconhecido");
    const links = new Map([["p-1", { locationId: GF_LOCATION_ID, projectId: "p-1", invoiceId: "inv-1" }]]);
    const h2 = harness({ rows: [row()], links, transport: { recordPayment: () => new Promise(() => {}) } });
    await run(h2, 5);
    expect(h2.log).toContain("o1:pagamento_a_conciliar:resultado_desconhecido");
  });
  it("reconcile row never POSTs; finds exact tx → concluido", async () => {
    const links = new Map([["p-1", { locationId: GF_LOCATION_ID, projectId: "p-1", invoiceId: "inv-1" }]]);
    const h = harness({ rows: [row({ state: "pagamento_a_conciliar" })], links, transport: { listTransactionsByInvoice: async () => [tx()] } });
    const r = await run(h);
    expect(h.calls.some((c) => c.startsWith("record") || c.startsWith("create"))).toBe(false);
    expect(r.done).toBe(1);
  });
  it("lease lost during reconciliation is not counted as done", async () => {
    const links = new Map([["p-1", { locationId: GF_LOCATION_ID, projectId: "p-1", invoiceId: "inv-1" }]]);
    const h = harness({ rows: [row({ state: "pagamento_a_conciliar" })], links, stateFails: true, transport: { listTransactionsByInvoice: async () => [tx()] } });
    const r = await run(h);
    expect(r.done).toBe(0); expect(r.leaseLost).toBe(1);
  });
  it("lease lost before POST → nothing sent", async () => {
    const h = harness({ rows: [row()], leaseLost: true });
    await run(h);
    expect(h.calls.filter((c) => !c.startsWith("get"))).toHaveLength(0);
  });
  it("project value differs from invoice total → revisao, no payment", async () => {
    const links = new Map([["p-1", { locationId: GF_LOCATION_ID, projectId: "p-1", invoiceId: "inv-1" }]]);
    const h = harness({ rows: [row()], links, projects: { "p-1": pj({ approvedTotalCents: 70000 }) }, transport: { getInvoice: async () => ({ kind: "ok", status: 200, value: inv() }) } });
    await run(h);
    expect(h.log).toContain("o1:revisao:valor_projeto_divergente");
    expect(h.calls.some((c) => c.startsWith("record"))).toBe(false);
  });
  it("remote invoice with our marker but no local link → reconcile, no second create", async () => {
    const h = harness({ rows: [row()], transport: { listInvoicesByContact: async () => [inv()] } });
    await run(h);
    expect(h.calls.some((c) => c.startsWith("create"))).toBe(false);
    expect(h.log).toContain("o1:fatura_a_conciliar:marcador_sem_vinculo");
  });
  it("same client, distinct projects keep distinct invoices", async () => {
    const h = harness({ rows: [row({ id: "o1" }), row({ id: "o2" }, { receiptId: "rcp-2", projectId: "p-2" })], projects: { "p-1": pj(), "p-2": pj({ id: "p-2" }) } });
    await run(h);
    expect(h.links.get("p-1")?.invoiceId).not.toBe(h.links.get("p-2")?.invoiceId);
  });
});

// ---------- HTTP adapter with fetch double ----------
describe("HTTP transport", () => {
  const mk = (handler: (url: string, init: RequestInit) => Response) => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const t = createHttpMirrorTransport({ token: "tok", fetch: async (u, i) => { seen.push({ url: u, init: i }); return handler(u, i); } });
    return { t, seen };
  };
  const sig = new AbortController().signal;
  it("record-payment official response {success, invoice}", async () => {
    const { t, seen } = mk(() => Response.json({ success: true, invoice: { _id: "inv-1" } }));
    const body = planPayment(rc(), inv(), pj(), PAY_OPTS); if (body.kind !== "send") throw new Error();
    expect(await t.recordPayment("inv-1", body.body, sig)).toEqual({ kind: "ok", status: 200, value: { success: true } });
    expect(seen[0].url).toContain("/invoices/inv-1/record-payment");
    expect((seen[0].init.headers as Record<string, string>)["Version"]).toBe("v3");
    expect(seen.some((s) => s.url.includes("/send"))).toBe(false);
  });
  it("truncated body / missing id → invalid; 500 → http", async () => {
    const { t } = mk(() => new Response("{", { status: 200 }));
    const p = planInvoice({ receipt: rc(), project: pj(), link: null, contact: ct(), studio }); if (p.kind !== "create") throw new Error();
    expect((await t.createInvoice(p.body, sig)).kind).toBe("invalid");
    const { t: t2 } = mk(() => new Response("x", { status: 500 }));
    expect(await t2.createInvoice(p.body, sig)).toEqual({ kind: "http", status: 500 });
  });
  it("parses draft invoice and marker", async () => {
    const { t } = mk(() => Response.json({ _id: "inv-1", altId: GF_LOCATION_ID, contactDetails: { id: "c-A" }, currency: "EUR", status: "draft", total: 600, amountDue: 600, termsNotes: projectMarker("p-1"), liveMode: false }));
    expect(await t.getInvoice("inv-1", sig)).toMatchObject({ kind: "ok", value: { status: "draft", totalCents: 60000, marker: projectMarker("p-1") } });
  });
  it("invalid list envelope throws (never treated as empty)", async () => {
    const { t } = mk(() => Response.json({ foo: 1 }));
    await expect(t.listInvoicesByContact("c-A", sig)).rejects.toThrow("invalid_envelope");
  });
});

// ---------- DB adapter with rpc double ----------
describe("Supabase store", () => {
  it("passes lease token to every fenced RPC and maps context", async () => {
    const calls: Array<[string, Record<string, unknown> | undefined]> = [];
    const db = { rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push([fn, args]);
      if (fn === "claim_payment_mirror") return { data: [{ id: "o1", lease_token: "L1", attempts: 1, state: "pending" }], error: null };
      if (fn === "mirror_load_context") return { data: { receipt: { id: "r1", project_id: "p-1", ghl_contact_id: "c-A", amount_cents: 15000, paid_on: "2026-10-05", method: "cash", sources: [] }, project: { id: "p-1", ghl_contact_id: "c-A", ghl_opportunity_id: null, title: "Braço", approved_total_eur: "600" }, contact: null, link: null, studio: null }, error: null };
      return { data: true, error: null };
    } };
    const s = createSupabaseMirrorStore(db);
    const [r] = await s.claim(5);
    const ctx = await s.loadContext(r);
    expect(ctx?.project?.approvedTotalCents).toBe(60000);
    await s.setState(r, "concluido", null, { ghlTransactionId: "t1" });
    expect(calls.filter(([f]) => f !== "claim_payment_mirror").every(([, a]) => a?.["p_token"] === "L1")).toBe(true);
  });
});

// ---------- endpoint handler + hook ----------
describe("worker endpoint", () => {
  const SECRET = "s".repeat(40);
  const req = (auth?: string) => new Request("http://x/api/public/payment-mirror-run", { method: "POST", headers: auth ? { authorization: auth } : {} });
  const deps = (gates = CLOSED) => {
    let built = 0;
    return { d: { gates, secret: SECRET, liveMode: false, makeStore: async () => { built++; return harness({ rows: [] }).store; }, makeTransport: async () => { built++; return harness({ rows: [] }).transport; } }, built: () => built };
  };
  it("missing secret 503, bad bearer 401, gates off → disabled with zero writes", async () => {
    const a = deps(); expect((await handleMirrorRun(req(`Bearer ${SECRET}`), { ...a.d, secret: undefined })).status).toBe(503);
    expect((await handleMirrorRun(req("Bearer nope"), a.d)).status).toBe(401);
    const r = await handleMirrorRun(req(`Bearer ${SECRET}`), a.d);
    expect(await r.json()).toEqual({ enabled: false });
    expect(a.built()).toBe(0);
  });
  it("gates on runs the worker", async () => {
    const a = deps(OPEN);
    const r = await handleMirrorRun(req(`Bearer ${SECRET}`), a.d);
    expect((await r.json()).enabled).toBe(true);
  });
});

describe("receipt hook", () => {
  const client = (role: string) => { const calls: string[] = []; return { calls, rpc: async (fn: string) => { calls.push(fn); return fn === "current_user_role" ? { data: role, error: null } : { data: "r1", error: null }; } }; };
  it("gates off: zero RPC", async () => {
    const c = client("admin");
    expect((await afterReceiptRecorded(c, [{ source: "payment", id: "x" }], CLOSED)).skipped).toBe("desligado");
    expect(c.calls).toHaveLength(0);
  });
  it("artist/unknown stay informado; admin confirms each real source", async () => {
    const art = client("artist");
    expect((await afterReceiptRecorded(art, [{ source: "payment", id: "x" }], OPEN)).skipped).toBe("nao_admin");
    expect(art.calls).toEqual(["current_user_role"]);
    const adm = client("admin");
    const r = await afterReceiptRecorded(adm, [{ source: "movimentacao", id: "m1" }, { source: "movimentacao", id: "m2" }, { source: "booking_deposit", id: "p1" }], OPEN);
    expect(r.confirmed).toBe(3);
  });
});
