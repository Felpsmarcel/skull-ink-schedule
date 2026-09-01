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
async function crmGet<T>(path: string, version = V_DEFAULT): Promise<T> {
  let last = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${GHL_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${crmToken()}`,
        Version: version,
        Accept: "application/json",
      },
    });
    const text = await res.text();
    if (res.ok) return (text ? JSON.parse(text) : {}) as T;
    last = `CRM ${res.status}: ${text.slice(0, 180)}`;
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
): Promise<CrmAppointmentRow[]> {
  const startMs = Date.parse(`${from}T00:00:00Z`);
  const endMs = Date.parse(`${to}T23:59:59Z`);
  const rows: CrmAppointmentRow[] = [];
  for (const cal of calendars) {
    const qs = new URLSearchParams({
      calendarId: cal.calendarId,
      locationId: CRM_LOCATION_ID,
      startTime: String(startMs),
      endTime: String(endMs),
    });
    const body = await crmGet<{ events?: CrmEvent[] }>(
      `/calendars/events?${qs.toString()}`,
      V_CALENDARS,
    );
    for (const e of body.events ?? []) {
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
  }
  return rows.sort((a, b) => a.start_at.localeCompare(b.start_at));
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

async function fetchPipelineMaps(): Promise<PipelineMaps> {
  const pipelines = new Map<string, string>();
  const stages = new Map<string, string>();
  try {
    const body = await crmGet<{
      pipelines?: Array<{ id: string; name?: string; stages?: Array<{ id: string; name?: string }> }>;
    }>(`/opportunities/pipelines?locationId=${CRM_LOCATION_ID}`);
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
): Promise<{ rows: CrmFinanceRow[]; truncated: boolean }> {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T23:59:59.999Z`);
  const maps = await fetchPipelineMaps();

  const rows: CrmFinanceRow[] = [];
  let startAfter: number | null = null;
  let startAfterId: string | null = null;
  let truncated = false;

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
    const body = await crmGet<{
      opportunities?: CrmOpportunity[];
      meta?: { startAfter?: number; startAfterId?: string; nextPage?: number | null };
    }>(`/opportunities/search?${qs.toString()}`);
    const batch = body.opportunities ?? [];
    if (batch.length === 0) break;

    let reachedOlder = false;
    for (const o of batch) {
      const createdMs = Date.parse(o.createdAt);
      if (Number.isFinite(createdMs) && createdMs < fromMs) {
        reachedOlder = true;
        continue;
      }
      if (Number.isFinite(createdMs) && createdMs > toMs) continue;
      rows.push({
        crm_opportunity_id: o.id,
        nome_cliente: o.contact?.name ?? o.name ?? null,
        valor_eur: Number(o.monetaryValue ?? 0),
        status: o.status ?? "unknown",
        pipeline: o.pipelineId ? (maps.pipelines.get(o.pipelineId) ?? o.pipelineId) : null,
        etapa: o.pipelineStageId ? (maps.stages.get(o.pipelineStageId) ?? o.pipelineStageId) : null,
        artist_name: o.assignedTo ? (artistsByUserId.get(o.assignedTo) ?? null) : null,
        criado_em: o.createdAt,
        atualizado_em: o.updatedAt ?? null,
      });
    }

    if (reachedOlder) break;
    const nextAfter = body.meta?.startAfter;
    const nextId = body.meta?.startAfterId;
    if (!body.meta?.nextPage || nextAfter == null || !nextId) break;
    startAfter = nextAfter;
    startAfterId = nextId;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  rows.sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  return { rows, truncated };
}

export interface CrmFinanceSummary extends Record<string, unknown> {
  fonte: "crm";
  base: "oportunidades";
  periodo: { from: string; to: string };
  registos: number;
  total_ganho_eur: number;
  total_aberto_eur: number;
  total_perdido_eur: number;
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
    periodo: { from, to },
    registos: rows.length,
    total_ganho_eur: statusTotal("won"),
    total_aberto_eur: statusTotal("open"),
    total_perdido_eur: statusTotal("lost") + statusTotal("abandoned"),
    por_status: [...byStatus.entries()]
      .map(([status, v]) => ({ status, registos: v.registos, total_eur: v.total }))
      .sort((a, b) => b.total_eur - a.total_eur),
    por_tatuador: [...byArtist.entries()]
      .map(([artist_name, v]) => ({ artist_name, registos: v.registos, total_eur: v.total }))
      .sort((a, b) => b.total_eur - a.total_eur),
    truncado: truncated,
    nota: "Valores vindos das oportunidades do CRM. O CRM não expõe registos de pagamento (custom objects/pagamentos) ao token atual.",
  };
}
