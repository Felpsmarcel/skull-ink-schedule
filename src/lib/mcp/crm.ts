import { dashboardPeriod } from "@/lib/dashboard-period";
/**
 * Leitura ao vivo do CRM (HighLevel) para as ferramentas MCP.
 *
 * Só é executado no runtime do servidor (rotas MCP). O token é lido do
 * ambiente em cada chamada — nunca em escopo de módulo.
 *
 * Escopos disponíveis no token atual: `calendars/events`, `opportunities`,
 * `contacts`, `pipelines`. Os endpoints `objects/*` (custom objects) e
 * `payments/transactions` respondem 401 (scope não autorizado), por isso a
 * verdade financeira do CRM usada aqui são as **oportunidades**.
 */

const GHL_BASE = "https://services.leadconnectorhq.com";
const V_CALENDARS = "2021-04-15";
const V_DEFAULT = "2021-07-28";
export const CRM_LOCATION_ID = "9iqrKUVPDddINb9S4Iwd";

type RuntimeGlobals = typeof globalThis & {
  Deno?: { env?: { get?: (name: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

function env(name: string): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  return (runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name])?.trim() || undefined;
}

function crmToken(): string {
  const token = env("GHL_TOKEN");
  if (!token) throw new Error("GHL_TOKEN ausente no servidor — CRM indisponível.");
  return token;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** O CRM limita o débito de pedidos; repetimos em 429 com backoff. */
async function crmGet<T>(path: string, version = V_DEFAULT, signal?: AbortSignal): Promise<T> {
  let last = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${GHL_BASE}${path}`, {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
        : AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${crmToken()}`,
        Version: version,
        Accept: "application/json",
      },
    });
    const text = await res.text();
    if (res.ok) return (text ? JSON.parse(text) : {}) as T;
    last = `CRM indisponível (${res.status})`;
    if (res.status !== 429 && res.status < 500) break;
    await sleep(700 * (attempt + 1));
  }
  throw new Error(last || "CRM: falha desconhecida");
}

/* -------------------------------------------------------------------------- */
/* Agenda                                                                      */
/* -------------------------------------------------------------------------- */

export interface CrmEvent {
  id: string;
  calendarId?: string;
  contactId?: string;
  title?: string;
  appointmentStatus?: string;
  startTime: string;
  endTime: string;
}

export interface CrmAppointmentRow {
  crm_event_id: string;
  artist_name: string;
  calendar_id: string;
  title: string | null;
  contact_id: string | null;
  start_at: string;
  end_at: string;
  status: string;
}

export function mapCrmStatus(s: string | undefined): string {
  switch ((s ?? "").toLowerCase()) {
    case "confirmed":
      return "confirmado";
    case "showed":
    case "completed":
      return "concluido";
    case "noshow":
    case "no_show":
      return "no_show";
    case "cancelled":
    case "invalid":
      return "cancelado";
    default:
      return "agendado";
  }
}

/** Eventos dos calendários indicados, no intervalo pedido (datas YYYY-MM-DD). */
export async function fetchCrmAppointments(
  calendars: Array<{ calendarId: string; artistName: string }>,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<{ rows: CrmAppointmentRow[]; truncated: boolean; partial: boolean }> {
  const period = dashboardPeriod(from, to);
  const startMs = Date.parse(period.startUtc);
  const endMs = Date.parse(period.endExclusiveUtc) - 1;
  let truncated = false;
  let partial = false;
  const rows: CrmAppointmentRow[] = [];
  for (const cal of calendars) {
    const qs = new URLSearchParams({
      calendarId: cal.calendarId,
      locationId: CRM_LOCATION_ID,
      startTime: String(startMs),
      endTime: String(endMs),
    });
    try {
      const body = await crmGet<{
        events?: CrmEvent[];
        meta?: { total?: number; nextPage?: unknown };
        total?: number;
      }>(`/calendars/events?${qs.toString()}`, V_CALENDARS, signal);
      if (!Array.isArray(body.events)) {
        partial = true;
        continue;
      }
      // No documented pagination proof for this API: flag possible server caps.
      if (
        body.events.length >= 100 ||
        body.meta?.nextPage ||
        (body.total ?? body.meta?.total ?? body.events.length) > body.events.length
      )
        truncated = true;
      for (const e of body.events) {
        const time = Date.parse(e.startTime);
        if (!Number.isFinite(time)) {
          partial = true;
          continue;
        }
        if (time < startMs || time > endMs) continue;
        if (e.calendarId && e.calendarId !== cal.calendarId) {
          partial = true;
          continue;
        }
        rows.push({
          crm_event_id: e.id,
          artist_name: cal.artistName,
          calendar_id: cal.calendarId,
          title: e.title ?? null,
          contact_id: e.contactId ?? null,
          start_at: e.startTime,
          end_at: e.endTime,
          status: mapCrmStatus(e.appointmentStatus),
        });
      }
    } catch {
      partial = true;
    }
  }
  return {
    rows: [...new Map(rows.map((r) => [r.crm_event_id, r])).values()].sort((a, b) =>
      a.start_at.localeCompare(b.start_at),
    ),
    truncated,
    partial,
  };
}

/* -------------------------------------------------------------------------- */
/* Financeiro (oportunidades)                                                  */
/* -------------------------------------------------------------------------- */

interface CrmOpportunity {
  id: string;
  name?: string;
  monetaryValue?: number | null;
  status?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  assignedTo?: string | null;
  contactId?: string | null;
  createdAt: string;
  updatedAt?: string;
  contact?: { name?: string; phone?: string; email?: string } | null;
}

export interface CrmFinanceRow {
  crm_opportunity_id: string;
  nome_cliente: string | null;
  valor_eur: number;
  status: string;
  pipeline: string | null;
  etapa: string | null;
  artist_name: string | null;
  criado_em: string;
  atualizado_em: string | null;
}

interface PipelineMaps {
  pipelines: Map<string, string>;
  stages: Map<string, string>;
}

async function fetchPipelineMaps(signal?: AbortSignal): Promise<PipelineMaps> {
  const pipelines = new Map<string, string>();
  const stages = new Map<string, string>();
  try {
    const body = await crmGet<{
      pipelines?: Array<{
        id: string;
        name?: string;
        stages?: Array<{ id: string; name?: string }>;
      }>;
    }>(`/opportunities/pipelines?locationId=${CRM_LOCATION_ID}`, V_DEFAULT, signal);
    for (const p of body.pipelines ?? []) {
      if (p.name) pipelines.set(p.id, p.name);
      for (const s of p.stages ?? []) if (s.name) stages.set(s.id, s.name);
    }
  } catch {
    // nomes de pipeline são acessórios; sem eles devolvemos os IDs.
  }
  return { pipelines, stages };
}

const MAX_PAGES = 25; // 25 * 100 = 2500 oportunidades por consulta

/**
 * Oportunidades criadas no intervalo pedido. A busca do CRM devolve por
 * ordem decrescente de criação, por isso paginamos com `startAfter` até
 * passar o início do intervalo.
 */
export async function fetchCrmFinance(
  from: string,
  to: string,
  artistsByUserId: Map<string, string>,
  restrictToUserId?: string | null,
  signal?: AbortSignal,
): Promise<{ rows: CrmFinanceRow[]; truncated: boolean }> {
  const period = dashboardPeriod(from, to);
  const fromMs = Date.parse(period.startUtc);
  const toMs = Date.parse(period.endExclusiveUtc);
  const maps = await fetchPipelineMaps(signal);

  const rows: CrmFinanceRow[] = [];
  let startAfter: number | null = null;
  let startAfterId: string | null = null;
  let truncated = false;
  let exhausted = false;
  const seenIds = new Set<string>();
  const seenCursors = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page++) {
    const qs = new URLSearchParams({
      location_id: CRM_LOCATION_ID,
      limit: "100",
    });
    if (restrictToUserId) qs.set("assigned_to", restrictToUserId);
    if (startAfter != null && startAfterId) {
      qs.set("startAfter", String(startAfter));
      qs.set("startAfterId", startAfterId);
    }
    try {
      const body = await crmGet<{
        opportunities?: CrmOpportunity[];
        meta?: {
          startAfter?: number;
          startAfterId?: string;
          nextPage?: number | null;
          total?: number;
        };
      }>(`/opportunities/search?${qs.toString()}`, V_DEFAULT, signal);
      if (!Array.isArray(body.opportunities)) {
        truncated = true;
        break;
      }
      const batch = body.opportunities;
      if (batch.length === 0) {
        exhausted = true;
        break;
      }
      for (const o of batch) {
        const createdMs = Date.parse(o.createdAt);
        if (seenIds.has(o.id)) continue;
        seenIds.add(o.id);
        if (!Number.isFinite(createdMs)) {
          truncated = true;
          continue;
        }
        if (createdMs < fromMs || createdMs >= toMs) continue;
        // CRM filters are not trusted as an authorization boundary.
        if (restrictToUserId && o.assignedTo !== restrictToUserId) continue;
        if (o.monetaryValue == null || !Number.isFinite(Number(o.monetaryValue))) {
          truncated = true;
          continue;
        }
        rows.push({
          crm_opportunity_id: o.id,
          nome_cliente: o.contact?.name ?? o.name ?? null,
          valor_eur: Number(o.monetaryValue ?? 0),
          status: o.status ?? "unknown",
          pipeline: o.pipelineId ? (maps.pipelines.get(o.pipelineId) ?? o.pipelineId) : null,
          etapa: o.pipelineStageId
            ? (maps.stages.get(o.pipelineStageId) ?? o.pipelineStageId)
            : null,
          artist_name: o.assignedTo ? (artistsByUserId.get(o.assignedTo) ?? null) : null,
          criado_em: o.createdAt,
          atualizado_em: o.updatedAt ?? null,
        });
      }

      const nextAfter = body.meta?.startAfter;
      const nextId = body.meta?.startAfterId;
      if (!body.meta?.nextPage) {
        if (batch.length < 100 && (body.meta?.total == null || seenIds.size >= body.meta.total))
          exhausted = true;
        else if (body.meta?.total != null && seenIds.size >= body.meta.total) exhausted = true;
        else truncated = true;
        break;
      }
      const cursor = `${nextAfter}:${nextId}`;
      if (nextAfter == null || !nextId || seenCursors.has(cursor)) {
        truncated = true;
        break;
      }
      seenCursors.add(cursor);
      startAfter = nextAfter;
      startAfterId = nextId;
      await sleep(200);
      if (page === MAX_PAGES - 1) truncated = true;
    } catch {
      truncated = true;
      break;
    }
  }

  rows.sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  return { rows, truncated: truncated || !exhausted };
}

export interface CrmFinanceSummary extends Record<string, unknown> {
  fonte: "crm";
  base: "oportunidades";
  periodo: { from: string; to: string };
  registos: number;
  total_ganho_eur: number | null;
  total_aberto_eur: number | null;
  total_perdido_eur: number | null;
  por_status: Array<{ status: string; registos: number; total_eur: number }>;
  por_tatuador: Array<{ artist_name: string; registos: number; total_eur: number }>;
  truncado: boolean;
  nota: string;
}

export function summarizeCrmFinance(
  rows: CrmFinanceRow[],
  from: string,
  to: string,
  truncated: boolean,
): CrmFinanceSummary {
  const byStatus = new Map<string, { registos: number; total: number }>();
  const byArtist = new Map<string, { registos: number; total: number }>();
  for (const r of rows) {
    const s = byStatus.get(r.status) ?? { registos: 0, total: 0 };
    s.registos += 1;
    s.total += r.valor_eur;
    byStatus.set(r.status, s);
    const key = r.artist_name ?? "(sem tatuador atribuído)";
    const a = byArtist.get(key) ?? { registos: 0, total: 0 };
    a.registos += 1;
    a.total += r.valor_eur;
    byArtist.set(key, a);
  }
  const statusTotal = (s: string) => byStatus.get(s)?.total ?? 0;
  return {
    fonte: "crm",
    base: "oportunidades",
    periodo: dashboardPeriod(from, to),
    registos: rows.length,
    total_ganho_eur: truncated ? null : statusTotal("won"),
    total_aberto_eur: truncated ? null : statusTotal("open"),
    total_perdido_eur: truncated ? null : statusTotal("lost") + statusTotal("abandoned"),
    por_status: (truncated ? [] : [...byStatus.entries()])
      .map(([status, v]) => ({ status, registos: v.registos, total_eur: v.total }))
      .sort((a, b) => b.total_eur - a.total_eur),
    por_tatuador: (truncated ? [] : [...byArtist.entries()])
      .map(([artist_name, v]) => ({ artist_name, registos: v.registos, total_eur: v.total }))
      .sort((a, b) => b.total_eur - a.total_eur),
    truncado: truncated,
    nota: "Valores vindos das oportunidades do CRM. O CRM não expõe registos de pagamento (custom objects/pagamentos) ao token atual.",
  };
}
