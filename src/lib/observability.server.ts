import {
  fingerprint,
  inferSeverity,
  normalizeSource,
  sanitizeContext,
  sanitizeMessage,
  type IncidentSeverity,
} from "@/lib/observability";

/**
 * Logger fail-open para uso dentro de código de servidor (sync, webhooks,
 * orquestração de agendamento). Nunca lança: se a observabilidade falhar,
 * a operação principal continua.
 */
export async function logIncident(input: {
  source: string;
  kind: string;
  message: unknown;
  severity?: IncidentSeverity;
  context?: Record<string, unknown>;
}): Promise<void> {
  try {
    const source = normalizeSource(input.source);
    const message = sanitizeMessage(input.message);
    const context = sanitizeContext(input.context);
    const httpStatus = typeof context.httpStatus === "number" ? context.httpStatus : null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).rpc("log_operational_event", {
      p_fingerprint: fingerprint(source, input.kind, message),
      p_source: source,
      p_kind: input.kind,
      p_severity: input.severity ?? inferSeverity(source, message, httpStatus),
      p_message: message,
      p_safe_context: context,
    });
  } catch (error) {
    console.warn("observability: log failed", sanitizeMessage(error));
  }
}
