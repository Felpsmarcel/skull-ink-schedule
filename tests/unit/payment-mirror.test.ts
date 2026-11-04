import { describe, it, expect } from "vitest";
import { decide, GF_LOCATION_ID, type InvoiceCandidate, type MirrorItem } from "@/lib/payment-mirror-core";
import { runPaymentMirror, type MirrorStore, type OutboxRow } from "@/lib/payment-mirror.server";

const item = (o: Partial<MirrorItem> = {}): MirrorItem => ({
  source: "movimentacao", sourceId: "r-1", confirmed: true, amountCents: 15000, currency: "EUR",
  paidOn: "2026-10-05", method: "cartao", ghlContactId: "c-A", ghlOpportunityId: "o-1", ...o,
});
const inv = (o: Partial<InvoiceCandidate> = {}): InvoiceCandidate => ({
  id: "inv-1", altId: GF_LOCATION_ID, contactId: "c-A", opportunityId: "o-1", status: "sent",
  amountDueCents: 60000, currency: "EUR", ...o,
});

function memStore(rows: OutboxRow[]) {
  const log: string[] = [];
  const store: MirrorStore = {
    claim: async () => rows,
    markSent: async (r) => { log.push(`sent:${r.id}`); return true; },
    markQueued: async (r, why) => { log.push(`queued:${r.id}:${why}`); },
    markFailed: async (r, why, retry) => { log.push(`failed:${r.id}:${why}:${retry}`); },
  };
  return { store, log };
}

describe("payment mirror", () => {
  it("sends only the installment amount, never project total", () => {
    const d = decide(item(), [inv()]);
    expect(d).toMatchObject({ kind: "send", invoiceId: "inv-1", body: { amount: 150, mode: "card" } });
  });
  it("two installments keep their own values and keys", () => {
    const a = decide(item({ sourceId: "r-1", amountCents: 15000 }), [inv()]);
    const b = decide(item({ sourceId: "r-2", amountCents: 20000 }), [inv()]);
    if (a.kind !== "send" || b.kind !== "send") throw new Error();
    expect([a.body.amount, b.body.amount]).toEqual([150, 200]);
    expect(a.body.meta.externalId).not.toBe(b.body.meta.externalId);
  });
  it("unconfirmed public entry is never sent", () => {
    expect(decide(item({ confirmed: false }), [inv()])).toEqual({ kind: "queue", reason: "nao_confirmado" });
  });
  it("no invoice or ambiguous invoices queue without POST", () => {
    expect(decide(item(), [])).toEqual({ kind: "queue", reason: "sem_fatura" });
    expect(decide(item({ ghlOpportunityId: null }), [inv(), inv({ id: "inv-2", opportunityId: "o-2" })]))
      .toEqual({ kind: "queue", reason: "faturas_ambiguas" });
  });
  it("foreign location, divergent contact and invalid value fail", () => {
    expect(decide(item(), [inv({ altId: "other" })])).toMatchObject({ kind: "fail", reason: "location_estrangeira" });
    expect(decide(item(), [inv({ contactId: "c-B" })])).toMatchObject({ kind: "fail", reason: "contato_divergente" });
    expect(decide(item({ amountCents: 0 }), [inv()])).toMatchObject({ kind: "fail", reason: "valor_invalido" });
    expect(decide(item({ amountCents: 10.5 }), [inv()])).toMatchObject({ kind: "fail", reason: "valor_invalido" });
  });

  it("disabled flag never calls transport", async () => {
    let calls = 0;
    const { store } = memStore([{ id: "x", leaseToken: "l", attempts: 0, item: item() }]);
    const r = await runPaymentMirror({ enabled: false, store, transport: {
      listInvoices: async () => { calls++; return []; }, recordPayment: async () => { calls++; return { status: 200, ref: null }; },
    } });
    expect(r.sent).toBe(0); expect(calls).toBe(0);
  });

  it("timeout marks retryable and retry reuses same externalId", async () => {
    const keys: string[] = [];
    let first = true;
    const transport = {
      listInvoices: async () => [inv()],
      recordPayment: async (_id: string, body: { meta: { externalId: string } }, s: AbortSignal) => {
        keys.push(body.meta.externalId);
        if (first) { first = false; return new Promise<never>((_, rej) => s.addEventListener("abort", () => rej(Object.assign(new Error("t"), { name: "AbortError" })))); }
        return { status: 200, ref: "p1" };
      },
    };
    const row = { id: "x", leaseToken: "l", attempts: 0, item: item() };
    const a = memStore([row]);
    await runPaymentMirror({ enabled: true, store: a.store, transport, timeoutMs: 5 });
    expect(a.log).toEqual(["failed:x:timeout:true"]);
    const b = memStore([{ ...row, attempts: 1 }]);
    await runPaymentMirror({ enabled: true, store: b.store, transport, timeoutMs: 5 });
    expect(b.log).toEqual(["sent:x"]);
    expect(new Set(keys).size).toBe(1);
  });

  it("4xx is not retried; 5xx is", async () => {
    for (const [status, retry] of [[422, false], [503, true]] as const) {
      const { store, log } = memStore([{ id: "x", leaseToken: "l", attempts: 0, item: item() }]);
      await runPaymentMirror({ enabled: true, store, transport: {
        listInvoices: async () => [inv()], recordPayment: async () => ({ status, ref: null }),
      } });
      expect(log).toEqual([`failed:x:http_${status}:${retry}`]);
    }
  });
});
