// Concrete HTTP adapter for GHL Invoices (new adapter only; legacy bridges keep their own Version header).
// Endpoints used: POST /invoices/, GET /invoices/{id}, GET /invoices/ (list), POST /invoices/{id}/record-payment,
// GET /payments/transactions. Never /send, never charges, never auto-pay. Token is never logged or returned.
// Units: API "amount" is a number with no stated unit — hypothesis: euros (cents/100). Homologate with EUR 1,23.
// record-payment schema marks card/cheque as required even for cash; we never fabricate them (contract gate).
import {
  GF_LOCATION_ID, GHL_INVOICES_API_VERSION,
  type CreateInvoiceBody, type RecordPaymentBody, type RemoteInvoice, type RemoteTransaction,
} from "./payment-mirror-core";
import type { HttpResult, MirrorTransport } from "./payment-mirror.server";

const BASE = "https://services.leadconnectorhq.com";
const FORBIDDEN = /\/send\b|charge|autopay|auto-payment|text2pay|schedule/i;
const PAGE = 100;
const MAX_PAGES = 50;

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const toCents = (n: unknown): number | null => {
  const v = typeof n === "string" ? Number(n) : n;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(v * 100);
};

function extractMarker(...texts: Array<unknown>): string | null {
  for (const t of texts) {
    if (typeof t !== "string") continue;
    const m = t.match(/gf-(?:project|receipt):[0-9a-zA-Z-]+/);
    if (m) return m[0];
  }
  return null;
}

export function parseInvoice(j: Record<string, unknown>): RemoteInvoice | null {
  const id = (j["_id"] ?? j["id"]) as string | undefined;
  const contact = j["contactDetails"] as { id?: string } | undefined;
  const total = toCents(j["total"]);
  const due = toCents(j["amountDue"]);
  if (!id || typeof j["altId"] !== "string" || typeof j["currency"] !== "string" || typeof j["status"] !== "string" || total == null || due == null) return null;
  return {
    id, altId: j["altId"] as string, contactId: contact?.id ?? null, currency: j["currency"] as string,
    status: j["status"] as string, totalCents: total, amountDueCents: due,
    marker: extractMarker(j["termsNotes"], j["name"]), liveMode: j["liveMode"] === true,
  };
}

export function parseTransaction(j: Record<string, unknown>): RemoteTransaction | null {
  const id = (j["_id"] ?? j["id"]) as string | undefined;
  const meta = (j["meta"] ?? {}) as { externalId?: string };
  const amount = toCents(j["amount"]);
  if (!id || amount == null) return null;
  return {
    id, invoiceId: (j["entityId"] as string) ?? null, altId: (j["altId"] as string) ?? "",
    contactId: (j["contactId"] as string) ?? null, currency: String(j["currency"] ?? "").toUpperCase(),
    amountCents: amount, marker: extractMarker(meta.externalId), status: String(j["status"] ?? ""),
    liveMode: j["liveMode"] === true, mode: String(j["paymentProviderType"] ?? j["mode"] ?? ""),
  };
}

export function createHttpMirrorTransport(opts: { token: string; fetch?: FetchLike }): MirrorTransport {
  const f: FetchLike = opts.fetch ?? ((u, i) => fetch(u, i));
  async function req(method: "GET" | "POST", path: string, s: AbortSignal, body?: unknown): Promise<{ status: number; json: unknown }> {
    if (FORBIDDEN.test(path)) throw new Error("forbidden_endpoint");
    const res = await f(`${BASE}${path}`, {
      method, signal: s,
      headers: { Authorization: `Bearer ${opts.token}`, Version: GHL_INVOICES_API_VERSION, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json: unknown = null;
    try { json = await res.json(); } catch { json = undefined; }
    return { status: res.status, json };
  }
  const q = (o: Record<string, string | number>) => new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)])).toString();
  const loc = { altId: GF_LOCATION_ID, altType: "location" };

  return {
    async createInvoice(body: CreateInvoiceBody, s) : Promise<HttpResult<{ invoiceId: string }>> {
      const r = await req("POST", "/invoices/", s, body);
      if (r.status < 200 || r.status >= 300) return { kind: "http", status: r.status };
      const id = (r.json as { _id?: string } | undefined)?._id;
      return typeof id === "string" && id ? { kind: "ok", status: r.status, value: { invoiceId: id } } : { kind: "invalid", status: r.status };
    },
    async getInvoice(id, s) {
      const r = await req("GET", `/invoices/${encodeURIComponent(id)}?${q(loc)}`, s);
      if (r.status < 200 || r.status >= 300) return { kind: "http", status: r.status };
      const inv = r.json && typeof r.json === "object" ? parseInvoice(r.json as Record<string, unknown>) : null;
      return inv && inv.id === id ? { kind: "ok", status: r.status, value: inv } : { kind: "invalid", status: r.status };
    },
    async recordPayment(invoiceId: string, body: RecordPaymentBody, s) {
      const r = await req("POST", `/invoices/${encodeURIComponent(invoiceId)}/record-payment`, s, body);
      if (r.status < 200 || r.status >= 300) return { kind: "http", status: r.status };
      const j = r.json as { success?: unknown; invoice?: { _id?: string } } | undefined;
      if (typeof j?.success !== "boolean" || (j.invoice && j.invoice._id !== invoiceId)) return { kind: "invalid", status: r.status };
      return { kind: "ok", status: r.status, value: { success: j.success } };
    },
    async listInvoicesByContact(contactId, s) {
      const out: RemoteInvoice[] = [];
      for (let p = 0; p < MAX_PAGES; p++) {
        const r = await req("GET", `/invoices/?${q({ ...loc, contactId, limit: PAGE, offset: p * PAGE })}`, s);
        if (r.status < 200 || r.status >= 300) throw new Error(`http_${r.status}`);
        const j = r.json as { invoices?: unknown[]; total?: number } | undefined;
        if (!j || !Array.isArray(j.invoices)) throw new Error("invalid_envelope");
        for (const it of j.invoices) { const inv = parseInvoice(it as Record<string, unknown>); if (!inv) throw new Error("invalid_item"); out.push(inv); }
        if (j.invoices.length < PAGE) return out;
      }
      throw new Error("pagination_exhausted"); // incomplete list never treated as complete
    },
    async listTransactionsByInvoice(invoiceId, s) {
      const out: RemoteTransaction[] = [];
      for (let p = 0; p < MAX_PAGES; p++) {
        const r = await req("GET", `/payments/transactions?${q({ ...loc, entityId: invoiceId, limit: PAGE, offset: p * PAGE })}`, s);
        if (r.status < 200 || r.status >= 300) throw new Error(`http_${r.status}`);
        const j = r.json as { data?: unknown[] } | undefined;
        if (!j || !Array.isArray(j.data)) throw new Error("invalid_envelope");
        for (const it of j.data) { const t = parseTransaction(it as Record<string, unknown>); if (!t) throw new Error("invalid_item"); out.push(t); }
        if (j.data.length < PAGE) return out;
      }
      throw new Error("pagination_exhausted");
    },
  };
}
