// Concrete HTTP adapter for GHL Invoices (new adapter only; legacy bridges keep their own Version header).
// Endpoints used: GET /contacts/{id}, POST /invoices/, GET /invoices/{id}, GET /invoices/ (list), POST /invoices/{id}/record-payment,
// GET /payments/transactions and GET /payments/transactions/{id} for authoritative readback.
// Never /send, never charges, never auto-pay. Token is never logged or returned.
// Units: API "amount" is a number with no stated unit — hypothesis: euros (cents/100). Homologate with EUR 1,23.
// record-payment schema marks card/cheque as required even for cash; we never fabricate them (contract gate).
import {
  GF_LOCATION_ID,
  GHL_INVOICES_API_VERSION,
  type CreateInvoiceBody,
  type RecordPaymentBody,
  type RemoteInvoice,
  type RemoteTransaction,
} from "./payment-mirror-core";
import type { HttpResult, MirrorTransport } from "./payment-mirror.server";

const BASE = "https://services.leadconnectorhq.com";
const FORBIDDEN = /\/send\b|charge|autopay|auto-payment|text2pay|schedule/i;
const PAGE = 100;
const MAX_PAGES = 50;

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const toCents = (n: unknown): number | null => {
  if (typeof n === "string" && !/^-?\d+(?:\.\d+)?$/.test(n)) return null;
  const v = typeof n === "string" ? Number(n) : n;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const scaled = v * 100;
  const cents = Math.round(scaled);
  // Tolerate floating-point representation noise, never round an actual partial cent.
  if (!Number.isSafeInteger(cents) || Math.abs(cents - scaled) > 1e-6) return null;
  return cents;
};

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && !/\s/.test(v);

function extractMarker(...texts: Array<unknown>): string | null {
  for (const t of texts) {
    if (typeof t !== "string") continue;
    const m = t.match(/gf-(?:project|receipt):[0-9a-zA-Z-]+/);
    if (m) return m[0];
  }
  return null;
}

function objectValue(v: unknown): Record<string, unknown> | null {
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function paymentMode(j: Record<string, unknown>): string {
  // Provider (Stripe/manual/etc.) identifies the processor, not cash/card/bank_transfer.
  // Unknown methods remain unknown so exact reconciliation fails closed.
  const method = objectValue(j["paymentMethod"]);
  const known = new Set(["cash", "card", "cheque", "bank_transfer", "other"]);
  for (const v of [
    j["mode"],
    j["paymentMode"],
    method?.["mode"],
    method?.["type"],
    j["paymentMethod"],
  ]) {
    if (typeof v === "string" && known.has(v)) return v;
  }
  if (objectValue(method?.["card"])) return "card";
  return "";
}

export function parseInvoice(j: Record<string, unknown>): RemoteInvoice | null {
  const id = j["_id"] ?? j["id"];
  const contact = objectValue(j["contactDetails"]);
  const total = toCents(j["total"]);
  const due = toCents(j["amountDue"]);
  if (
    !isId(id) ||
    !isId(j["altId"]) ||
    !isId(contact?.["id"]) ||
    typeof j["currency"] !== "string" ||
    typeof j["status"] !== "string" ||
    typeof j["liveMode"] !== "boolean" ||
    total == null ||
    due == null
  )
    return null;
  return {
    id,
    altId: j["altId"] as string,
    contactId: contact!["id"] as string,
    currency: j["currency"] as string,
    status: j["status"] as string,
    totalCents: total,
    amountDueCents: due,
    marker: extractMarker(j["termsNotes"], j["name"]),
    liveMode: j["liveMode"] === true,
  };
}

export function parseTransaction(j: Record<string, unknown>): RemoteTransaction | null {
  const id = j["_id"] ?? j["id"];
  const meta = objectValue(j["meta"]);
  const amount = toCents(j["amount"]);
  if (
    !isId(id) ||
    !isId(j["altId"]) ||
    !isId(j["contactId"]) ||
    typeof j["currency"] !== "string" ||
    typeof j["status"] !== "string" ||
    typeof j["liveMode"] !== "boolean" ||
    amount == null
  )
    return null;
  // An order entityId can differ from the invoiceId. Prefer the explicit invoice identity.
  const invoiceId = j["invoiceId"] ?? j["entityId"];
  if (!isId(invoiceId)) return null;
  return {
    id,
    invoiceId,
    altId: (j["altId"] as string) ?? "",
    contactId: (j["contactId"] as string) ?? null,
    currency: String(j["currency"] ?? "").toUpperCase(),
    amountCents: amount,
    marker: extractMarker(meta?.["externalId"]),
    status: String(j["status"] ?? ""),
    liveMode: j["liveMode"] === true,
    mode: paymentMode(j),
  };
}

export function createHttpMirrorTransport(opts: {
  token: string;
  fetch?: FetchLike;
}): MirrorTransport {
  const f: FetchLike = opts.fetch ?? ((u, i) => fetch(u, i));
  async function req(
    method: "GET" | "POST",
    path: string,
    s: AbortSignal,
    body?: unknown,
  ): Promise<{ status: number; json: unknown }> {
    if (FORBIDDEN.test(path)) throw new Error("forbidden_endpoint");
    const res = await f(`${BASE}${path}`, {
      method,
      signal: s,
      headers: {
        Authorization: `Bearer ${opts.token}`,
        Version: GHL_INVOICES_API_VERSION,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = undefined;
    }
    return { status: res.status, json };
  }
  const q = (o: Record<string, string | number>) =>
    new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)])).toString();
  const loc = { altId: GF_LOCATION_ID, altType: "location" };

  async function listAll(
    path: string,
    params: Record<string, string>,
    rowsKey: "invoices" | "data",
    totalKey: "total" | "totalCount",
    s: AbortSignal,
  ): Promise<Record<string, unknown>[]> {
    const out: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    let expectedTotal: number | null = null;
    for (let p = 0; p < MAX_PAGES; p++) {
      const r = await req(
        "GET",
        `${path}?${q({ ...loc, ...params, limit: PAGE, offset: out.length })}`,
        s,
      );
      if (r.status < 200 || r.status >= 300) throw new Error(`http_${r.status}`);
      const j = objectValue(r.json);
      const rows = j?.[rowsKey];
      const total = j?.[totalKey];
      if (
        !Array.isArray(rows) ||
        !Number.isSafeInteger(total) ||
        (total as number) < 0 ||
        rows.length > PAGE
      )
        throw new Error("invalid_envelope");
      if (expectedTotal != null && total !== expectedTotal) throw new Error("pagination_changed");
      expectedTotal = total as number;
      for (const raw of rows) {
        const item = objectValue(raw);
        const id = item?.["_id"] ?? item?.["id"];
        if (!item || typeof id !== "string" || !id || seen.has(id))
          throw new Error("invalid_or_duplicate_item");
        seen.add(id);
        out.push(item);
      }
      if (out.length > expectedTotal) throw new Error("pagination_contradiction");
      if (out.length === expectedTotal) return out;
      if (rows.length === 0) throw new Error("pagination_incomplete");
      // Short pages are not completeness evidence. Advance by rows actually read, then verify total.
    }
    throw new Error("pagination_exhausted");
  }

  return {
    async createInvoice(body: CreateInvoiceBody, s): Promise<HttpResult<{ invoiceId: string }>> {
      // Cache membership is not proof of the current remote identity/location.
      // Get Contact's documented envelope is { contact: { id, locationId, ... } }.
      // Verify immediately before creation; do not replace caller/customer fields with remote data.
      const contactId = body.contactDetails?.id;
      if (
        body.altId !== GF_LOCATION_ID ||
        body.altType !== "location" ||
        typeof contactId !== "string" ||
        !contactId
      )
        return { kind: "invalid", status: 422 };
      const preflight = await req("GET", `/contacts/${encodeURIComponent(contactId)}`, s);
      if (preflight.status < 200 || preflight.status >= 300)
        return { kind: "http", status: preflight.status };
      const envelope = objectValue(preflight.json);
      const contact = objectValue(envelope?.["contact"]);
      if (!contact || contact["id"] !== contactId || contact["locationId"] !== GF_LOCATION_ID)
        return { kind: "invalid", status: preflight.status };
      const r = await req("POST", "/invoices/", s, body);
      if (r.status < 200 || r.status >= 300) return { kind: "http", status: r.status };
      const id = (r.json as { _id?: string } | undefined)?._id;
      return typeof id === "string" && id
        ? { kind: "ok", status: r.status, value: { invoiceId: id } }
        : { kind: "invalid", status: r.status };
    },
    async getInvoice(id, s) {
      const r = await req("GET", `/invoices/${encodeURIComponent(id)}?${q(loc)}`, s);
      if (r.status < 200 || r.status >= 300) return { kind: "http", status: r.status };
      const inv =
        r.json && typeof r.json === "object"
          ? parseInvoice(r.json as Record<string, unknown>)
          : null;
      return inv && inv.id === id
        ? { kind: "ok", status: r.status, value: inv }
        : { kind: "invalid", status: r.status };
    },
    async recordPayment(invoiceId: string, body: RecordPaymentBody, s) {
      const r = await req(
        "POST",
        `/invoices/${encodeURIComponent(invoiceId)}/record-payment`,
        s,
        body,
      );
      if (r.status < 200 || r.status >= 300) return { kind: "http", status: r.status };
      const j = r.json as { success?: unknown; invoice?: { _id?: string } } | undefined;
      if (typeof j?.success !== "boolean" || (j.invoice && j.invoice._id !== invoiceId))
        return { kind: "invalid", status: r.status };
      return { kind: "ok", status: r.status, value: { success: j.success } };
    },
    async listInvoicesByContact(contactId, s) {
      const rows = await listAll("/invoices/", { contactId }, "invoices", "total", s);
      return rows.map((row) => {
        const inv = parseInvoice(row);
        if (!inv) throw new Error("invalid_item");
        return inv;
      });
    },
    async listTransactionsByInvoice(invoiceId, s) {
      const rows = await listAll(
        "/payments/transactions",
        { entityId: invoiceId },
        "data",
        "totalCount",
        s,
      );
      const out: RemoteTransaction[] = [];
      for (const row of rows) {
        const id = String(row["_id"] ?? row["id"]);
        const r = await req("GET", `/payments/transactions/${encodeURIComponent(id)}?${q(loc)}`, s);
        if (r.status < 200 || r.status >= 300) throw new Error(`http_${r.status}`);
        const detail = objectValue(r.json);
        const t = detail ? parseTransaction(detail) : null;
        if (!t || t.id !== id) throw new Error("invalid_transaction_detail");
        // The list documents paymentMethod while details document identity and meta.
        // Use only an explicit list method when details omit it; never copy list identity/meta.
        if (!t.mode) t.mode = paymentMode(row);
        out.push(t);
      }
      return out;
    },
  };
}
