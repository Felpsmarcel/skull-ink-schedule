/**
 * Leitura paginada e fail-closed de oportunidades GHL (pura, testável).
 * Inclui todos os status (open/won/lost/abandoned). Página repetida, erro,
 * total contraditório ou limite de páginas => incompleto (bloqueia ação).
 */
export interface OpportunityLite {
  id: string;
  name: string | null;
  status: string | null;
  pipelineId: string | null;
  pipelineStageId: string | null;
  contactId: string | null;
  monetaryValueCents: number | null;
}

export type FetchOpportunityPage = (
  page: number,
) => Promise<
  | { ok: true; rows: Array<Record<string, unknown>>; total: number | null }
  | { ok: false; status: number }
>;

export type IncompleteReason =
  | "http_error"
  | "repeated_page"
  | "page_limit"
  | "total_mismatch"
  | "contact_mismatch";

export interface OpportunityReadResult {
  items: OpportunityLite[];
  complete: boolean;
  reason: IncompleteReason | null;
  pagesRead: number;
}

export const OPP_PAGE_SIZE = 100;

function cents(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function mapOpportunity(o: Record<string, unknown>): OpportunityLite {
  const contact = o["contact"] as Record<string, unknown> | undefined;
  return {
    id: String(o["id"] ?? ""),
    name: (o["name"] as string | undefined) ?? null,
    status: (o["status"] as string | undefined) ?? null,
    pipelineId: (o["pipelineId"] as string | undefined) ?? null,
    pipelineStageId: (o["pipelineStageId"] as string | undefined) ?? null,
    contactId: ((o["contactId"] ?? contact?.["id"]) as string | undefined) ?? null,
    monetaryValueCents: cents(o["monetaryValue"]),
  };
}

export async function readAllOpportunities(
  fetchPage: FetchOpportunityPage,
  opts: { expectedContactId?: string; maxPages?: number } = {},
): Promise<OpportunityReadResult> {
  const maxPages = opts.maxPages ?? 20;
  const seen = new Map<string, OpportunityLite>();
  let total: number | null = null;
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetchPage(page);
    if (!res.ok)
      return {
        items: [...seen.values()],
        complete: false,
        reason: "http_error",
        pagesRead: page - 1,
      };
    if (res.total !== null) total = res.total;
    let fresh = 0;
    for (const raw of res.rows) {
      const o = mapOpportunity(raw);
      if (!o.id) continue;
      if (opts.expectedContactId && o.contactId && o.contactId !== opts.expectedContactId) {
        return { items: [], complete: false, reason: "contact_mismatch", pagesRead: page };
      }
      if (seen.has(o.id)) continue;
      seen.set(o.id, o);
      fresh++;
    }
    if (res.rows.length > 0 && fresh === 0) {
      return {
        items: [...seen.values()],
        complete: false,
        reason: "repeated_page",
        pagesRead: page,
      };
    }
    if (res.rows.length < OPP_PAGE_SIZE) {
      if (total !== null && total !== seen.size) {
        return {
          items: [...seen.values()],
          complete: false,
          reason: "total_mismatch",
          pagesRead: page,
        };
      }
      return { items: [...seen.values()], complete: true, reason: null, pagesRead: page };
    }
  }
  return { items: [...seen.values()], complete: false, reason: "page_limit", pagesRead: maxPages };
}

/** Pipelines comerciais confirmados por leitura, por artist_id. Ausente => configuração pendente. */
export const ARTIST_PIPELINES: Readonly<Record<string, string>> = {
  // André Pareyn — "FUNIL ANDRE PAREYN", lido via GET /opportunities/pipelines em 11/11/2026.
  "8489abdc-3a9a-4114-85a1-a4947da979df": "eftXuh8pi2jGaXXzpz5O",
};

export function artistPipelineId(artistId: string | null | undefined): string | null {
  return artistId ? (ARTIST_PIPELINES[artistId] ?? null) : null;
}

export const OPP_STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  won: "Ganha",
  lost: "Perdida",
  abandoned: "Abandonada",
};
