import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  fingerprint,
  inferSeverity,
  normalizeSource,
  prioritizeIncidents,
  healthLevel,
  sanitizeContext,
  sanitizeMessage,
  type Incident,
  type IncidentSeverity,
  type OperationalHealth,
} from "@/lib/observability";

/* ------------------------------ Logger ------------------------------ */

export interface LogIncidentInput {
  source: string;
  kind: string;
  message: string;
  severity?: IncidentSeverity;
  context?: Record<string, unknown>;
}

/**
 * Logger fail-open: nunca lança. Se a gravação falhar, a operação principal
 * (agendamento, pagamento, check-in) continua normalmente.
 */
export const logOperationalEvent = createServerFn({ method: "POST" })
  .inputValidator((input: LogIncidentInput) => input)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    try {
      const source = normalizeSource(data.source);
      const message = sanitizeMessage(data.message);
      const context = sanitizeContext(data.context);
      const httpStatus = typeof context.httpStatus === "number" ? context.httpStatus : null;
      const severity = data.severity ?? inferSeverity(source, message, httpStatus);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabaseAdmin as any).rpc("log_operational_event", {
        p_fingerprint: fingerprint(source, data.kind, message),
        p_source: source,
        p_kind: data.kind,
        p_severity: severity,
        p_message: message,
        p_safe_context: context,
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (error) {
      console.warn("observability: log failed", sanitizeMessage(error));
      return { ok: false };
    }
  });

/* ------------------------------ Painel ------------------------------ */

interface RawIncident {
  id: string;
  fingerprint: string;
  source: string;
  kind: string;
  severity: string;
  status: string;
  message: string;
  safe_context: Record<string, unknown> | null;
  occurrences: number;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_at: string | null;
}

function mapIncident(row: RawIncident): Incident {
  return {
    id: String(row.id),
    fingerprint: String(row.fingerprint),
    source: normalizeSource(row.source),
    kind: String(row.kind),
    severity: (row.severity as Incident["severity"]) ?? "media",
    status: (row.status as Incident["status"]) ?? "open",
    message: sanitizeMessage(row.message),
    safeContext: sanitizeContext(row.safe_context ?? {}),
    occurrences: Number(row.occurrences ?? 1),
    firstSeenAt: String(row.first_seen_at),
    lastSeenAt: String(row.last_seen_at),
    acknowledgedAt: row.acknowledged_at ? String(row.acknowledged_at) : null,
  };
}

/** Painel de saúde consolidado. A RPC já rejeita quem não é admin. */
export const getOperationalHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OperationalHealth> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any).rpc("operational_health");
    if (error) throw new Error(sanitizeMessage(error.message));
    const payload = (data ?? {}) as Record<string, unknown>;
    const metrics = {
      openCount: Number(payload.openCount ?? 0),
      criticalCount: Number(payload.criticalCount ?? 0),
      syncFailures: Number(payload.syncFailures ?? 0),
      reconciliationRequired: Number(payload.reconciliationRequired ?? 0),
      movimentacoesFailed: Number(payload.movimentacoesFailed ?? 0),
      checkinsFailed: Number(payload.checkinsFailed ?? 0),
    };
    const incidents = prioritizeIncidents(
      ((payload.incidents ?? []) as RawIncident[]).map(mapIncident),
    );
    return {
      level: healthLevel(metrics),
      metrics,
      incidents,
      generatedAtISO: new Date().toISOString(),
      degraded: false,
    };
  });

/** Reconhecer preserva o histórico: não apaga nem zera as ocorrências. */
export const acknowledgeIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from("operational_events")
      .update({
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(sanitizeMessage(error.message));
    return { ok: true };
  });

export const resolveIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from("operational_events")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(sanitizeMessage(error.message));
    return { ok: true };
  });
