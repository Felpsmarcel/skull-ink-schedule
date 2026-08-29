/**
 * Fase 5 — lógica pura da camada de observabilidade operacional.
 *
 * Nada aqui toca banco de dados, rede ou GHL. O objetivo é permitir testes
 * unitários do fingerprint (deduplicação), da sanitização de contexto
 * (allow-list, sem PII), da severidade e da ordenação dos incidentes.
 */

export const OBS_TZ = "Europe/Brussels";

export type IncidentSeverity = "critica" | "alta" | "media" | "baixa";
export type IncidentStatus = "open" | "acknowledged" | "resolved";

/** Origens conhecidas de falha. Qualquer outra vira "app". */
export type IncidentSource = "ghl" | "supabase" | "app" | "email" | "checkin" | "pagamento";

const SOURCES: IncidentSource[] = ["ghl", "supabase", "app", "email", "checkin", "pagamento"];

export function normalizeSource(value: string | null | undefined): IncidentSource {
  const v = (value ?? "").trim().toLowerCase();
  return (SOURCES as string[]).includes(v) ? (v as IncidentSource) : "app";
}

/**
 * Campos permitidos no contexto do incidente. Tudo fora desta lista é
 * descartado — nunca gravamos nome, telefone, e-mail ou payload cru.
 */
export const SAFE_CONTEXT_KEYS = [
  "status",
  "httpStatus",
  "step",
  "attempts",
  "operationId",
  "calendarId",
  "route",
  "rpc",
  "table",
  "durationMs",
  "count",
] as const;

export type SafeContext = Record<string, string | number | boolean>;

const PII_HINTS = /(name|nome|email|mail|phone|tel|address|endere|token|secret|key|password|cpf|iban)/i;

/** Mantém apenas chaves da allow-list, valores escalares e strings curtas. */
export function sanitizeContext(input: unknown): SafeContext {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: SafeContext = {};
  for (const key of SAFE_CONTEXT_KEYS) {
    const value = (input as Record<string, unknown>)[key];
    if (value === undefined || value === null) continue;
    if (PII_HINTS.test(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean") out[key] = value;
    else if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) out[key] = trimmed.slice(0, 80);
    }
  }
  return out;
}

/**
 * Mensagem segura: sem PII evidente, sem e-mails/telefones, truncada.
 * Preserva o suficiente para diagnóstico ("GHL 401 unauthorized").
 */
export function sanitizeMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  return raw
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[tel]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[id]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/**
 * Fingerprint estável: agrupa ocorrências do mesmo problema, ignorando
 * números variáveis e IDs, para não inflar a lista de incidentes.
 */
export function fingerprint(source: string, kind: string, message: string): string {
  const normalized = sanitizeMessage(message)
    .toLowerCase()
    .replace(/\[(email|tel|id)\]/g, "")
    .replace(/\d+/g, "#")
    .replace(/[^a-z#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${normalizeSource(source)}:${(kind || "unknown").trim().toLowerCase()}:${normalized}`;
}

/** Severidade derivada da origem + sinal técnico, quando não informada. */
export function inferSeverity(
  source: string,
  message: string,
  httpStatus?: number | null,
): IncidentSeverity {
  const msg = message.toLowerCase();
  if (httpStatus === 401 || httpStatus === 403 || /unauthorized|forbidden|jwt/.test(msg)) {
    return "critica";
  }
  if (/reconcil|duplicat|idempot|integrity|constraint/.test(msg)) return "critica";
  if (httpStatus && httpStatus >= 500) return "alta";
  if (/timeout|network|fetch failed|econnreset/.test(msg)) return "alta";
  if (normalizeSource(source) === "email") return "media";
  return "media";
}

export interface Incident {
  id: string;
  fingerprint: string;
  source: IncidentSource;
  kind: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  message: string;
  safeContext: SafeContext;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  acknowledgedAt: string | null;
}

const SEV_RANK: Record<IncidentSeverity, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };
const STATUS_RANK: Record<IncidentStatus, number> = { open: 0, acknowledged: 1, resolved: 2 };

/**
 * Ordena incidentes: abertos antes de reconhecidos, mais graves primeiro,
 * depois mais recentes. Resolvidos nunca aparecem no painel ativo.
 */
export function prioritizeIncidents(list: Incident[], limit = 20): Incident[] {
  return list
    .filter((i) => i.status !== "resolved")
    .sort((a, b) => {
      const st = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (st !== 0) return st;
      const sev = SEV_RANK[a.severity] - SEV_RANK[b.severity];
      if (sev !== 0) return sev;
      return Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
    })
    .slice(0, limit);
}

export interface HealthMetrics {
  openCount: number;
  criticalCount: number;
  syncFailures: number;
  reconciliationRequired: number;
  movimentacoesFailed: number;
  checkinsFailed: number;
}

export type HealthLevel = "ok" | "atencao" | "critico";

/** Semáforo global do estúdio: uma leitura, sem interpretação ambígua. */
export function healthLevel(m: HealthMetrics): HealthLevel {
  if (m.criticalCount > 0 || m.reconciliationRequired > 0) return "critico";
  if (
    m.openCount > 0 ||
    m.syncFailures > 0 ||
    m.movimentacoesFailed > 0 ||
    m.checkinsFailed > 0
  ) {
    return "atencao";
  }
  return "ok";
}

export interface OperationalHealth {
  level: HealthLevel;
  metrics: HealthMetrics;
  incidents: Incident[];
  generatedAtISO: string;
  /** Alguma métrica não carregou; o painel continua utilizável. */
  degraded: boolean;
}

/** Data/hora curta no fuso do estúdio. */
export function brusselsStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: OBS_TZ,
  });
}

export const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const SOURCE_LABEL: Record<IncidentSource, string> = {
  ghl: "CRM (HighLevel)",
  supabase: "Banco de dados",
  app: "Aplicativo",
  email: "E-mail",
  checkin: "Check-in",
  pagamento: "Pagamento",
};
