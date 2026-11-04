// Pure rules for mirroring confirmed receipts into GHL invoices.
// No I/O here. Values are integer euro cents.

export const GF_LOCATION_ID = "9iqrKUVPDddINb9S4Iwd";

export type MirrorSource = "movimentacao" | "payment";
export type LocalMethod = "cartao" | "dinheiro" | "sumup" | "transferencia" | "card" | "cash" | "transfer" | "payconiq" | "other";
export type GhlMode = "card" | "cash" | "bank_transfer" | "other";

export interface MirrorItem {
  source: MirrorSource;
  sourceId: string; // immutable receipt id
  confirmed: boolean; // set only by authenticated admin confirmation
  amountCents: number; // installment actually received
  currency: string;
  paidOn: string; // YYYY-MM-DD
  method: LocalMethod;
  ghlContactId: string | null;
  ghlOpportunityId: string | null;
}

export interface InvoiceCandidate {
  id: string;
  altId: string; // location id
  contactId: string | null;
  opportunityId?: string | null;
  status: string;
  amountDueCents: number;
  currency: string;
}

export type Decision =
  | { kind: "send"; invoiceId: string; body: RecordPaymentBody }
  | { kind: "queue"; reason: "nao_confirmado" | "sem_fatura" | "faturas_ambiguas" | "saldo_insuficiente" }
  | { kind: "fail"; reason: string };

export interface RecordPaymentBody {
  altId: string;
  altType: "location";
  mode: GhlMode;
  amount: number; // euros with 2 decimals, derived from cents
  meta: { externalId: string };
  notes: string;
}

export function mapMethod(m: LocalMethod): GhlMode {
  switch (m) {
    case "cartao": case "sumup": case "card": return "card";
    case "dinheiro": case "cash": return "cash";
    case "transferencia": case "transfer": return "bank_transfer";
    default: return "other";
  }
}

export function idempotencyKey(item: Pick<MirrorItem, "source" | "sourceId">): string {
  return `gf-receipt:${item.source}:${item.sourceId}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateItem(item: MirrorItem): string | null {
  if (!item.sourceId) return "id_ausente";
  if (!Number.isInteger(item.amountCents) || item.amountCents <= 0) return "valor_invalido";
  if (item.currency !== "EUR") return "moeda_invalida";
  if (!DATE_RE.test(item.paidOn)) return "data_invalida";
  if (!item.ghlContactId) return "contato_ausente";
  return null;
}

export function decide(item: MirrorItem, invoices: InvoiceCandidate[]): Decision {
  if (!item.confirmed) return { kind: "queue", reason: "nao_confirmado" };
  const err = validateItem(item);
  if (err) return { kind: "fail", reason: err };
  if (invoices.some((i) => i.altId !== GF_LOCATION_ID)) return { kind: "fail", reason: "location_estrangeira" };
  if (invoices.some((i) => i.contactId !== item.ghlContactId)) return { kind: "fail", reason: "contato_divergente" };
  let open = invoices.filter((i) => i.currency === "EUR" && !["paid", "void", "draft"].includes(i.status));
  if (item.ghlOpportunityId) {
    const byOpp = open.filter((i) => i.opportunityId === item.ghlOpportunityId);
    if (byOpp.length) open = byOpp;
  }
  if (open.length === 0) return { kind: "queue", reason: "sem_fatura" };
  if (open.length > 1) return { kind: "queue", reason: "faturas_ambiguas" };
  const inv = open[0];
  if (inv.amountDueCents < item.amountCents) return { kind: "queue", reason: "saldo_insuficiente" };
  return {
    kind: "send",
    invoiceId: inv.id,
    body: {
      altId: GF_LOCATION_ID,
      altType: "location",
      mode: mapMethod(item.method),
      amount: item.amountCents / 100,
      meta: { externalId: idempotencyKey(item) },
      notes: `Recebimento GF ${item.paidOn}`,
    },
  };
}
