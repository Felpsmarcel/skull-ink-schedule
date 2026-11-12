// Server-only. Sincroniza um check-in do totem com o HighLevel.
// Best-effort: qualquer falha aqui NÃO desfaz o registo local do check-in.
//
// IDs de agendamento vêm da leitura canônica do servidor. Não inferir primeiro evento ou oportunidade.
// Tag/campos são sincronização operacional; workflow explícito exige consentimento.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GHL_BASE = "https://services.leadconnectorhq.com";
const V_CONTACTS = "2021-07-28";
export const CHECKIN_LOCATION_ID = "9iqrKUVPDddINb9S4Iwd";
export const CHECKIN_TAG = "check-in-totem-gf";
export const STATUS_AGUARDANDO = "Aguardando atendimento";

export interface CheckinSyncInput {
  checkinId: string;
  clienteNome: string;
  clienteTelefone: string | null;
  clienteEmail?: string | null;
  ghlContactId: string | null;
  /** ID observado no agendamento local selecionado e validado, nunca buscado por dia/nome. */
  ghlAppointmentId: string | null;
  consentimento: boolean;
  codigoAtendimento: string;
  qrUrl: string;
  arrivedAtISO: string;
}

export interface CheckinSyncResult {
  ok: boolean;
  ghlContactId?: string;
  ghlAppointmentId?: string;
  ghlOpportunityId?: string;
  /** Solicitação de workflow aceita; não comprova envio nem entrega ao cliente. */
  workflowTriggered?: boolean;
  error?: string;
  steps: string[];
}

function headers(token: string, version: string) {
  return {
    Authorization: `Bearer ${token}`,
    Version: version,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function call(
  path: string,
  init: RequestInit,
  token: string,
  version = V_CONTACTS,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${GHL_BASE}${path}`, {
    ...init,
    headers: { ...headers(token, version), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("app_settings" as never)
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error("Não foi possível verificar a configuração do workflow de check-in.");
  const value = (data as { value?: { id?: string } } | null)?.value;
  return value?.id ?? null;
}

export async function syncCheckinToGhl(input: CheckinSyncInput): Promise<CheckinSyncResult> {
  const steps: string[] = [];
  const token = process.env.GHL_TOKEN;
  if (!token) return { ok: false, error: "GHL_TOKEN ausente", steps };

  try {
    const contactId = input.ghlContactId?.trim();
    if (!contactId) {
      steps.push("contacto: sem vínculo GHL confirmado; revisão necessária");
      return {
        ok: false,
        error:
          "Chegada local preservada. Confirme o vínculo do contato antes de sincronizar com o GHL.",
        steps,
      };
    }
    steps.push("contacto: vínculo canônico preservado");

    const appointmentId = input.ghlAppointmentId || undefined;
    steps.push(
      appointmentId
        ? "agendamento: ID canônico preservado"
        : "agendamento: sem vínculo GHL confirmado",
    );
    // No explicit validated project/opportunity correlation exists in this flow.
    // Do not select a contact's first opportunity from any pipeline.
    steps.push("oportunidade: sem vínculo confirmado; não associada");

    // Tag
    const tagRes = await call(
      `/contacts/${contactId}/tags`,
      { method: "POST", body: JSON.stringify({ tags: [CHECKIN_TAG] }) },
      token,
    );
    steps.push(tagRes.ok ? "tag: aplicada" : `tag: falhou (${tagRes.status})`);

    // Campos personalizados do check-in
    const fieldsRes = await call(
      `/contacts/${contactId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          customFields: [
            { key: "checkin_status", field_value: STATUS_AGUARDANDO },
            { key: "checkin_codigo", field_value: input.codigoAtendimento },
            { key: "checkin_url", field_value: input.qrUrl },
            { key: "checkin_arrived_at", field_value: input.arrivedAtISO },
            { key: "checkin_source", field_value: "Totem GF" },
          ],
        }),
      },
      token,
    );
    steps.push(fieldsRes.ok ? "campos: atualizados" : `campos: falhou (${fieldsRes.status})`);

    // Consent is optional for arrival registration, mandatory for this explicit communication trigger.
    // External automations on tags/fields still require a separate staging review.
    let workflowTriggered = false;
    let workflowFailed = false;
    if (input.consentimento === true) {
      const workflowId = await getSetting("ghl_checkin_workflow_id");
      if (workflowId) {
        const wf = await call(
          `/contacts/${contactId}/workflow/${workflowId}`,
          { method: "POST", body: JSON.stringify({ eventStartTime: input.arrivedAtISO }) },
          token,
        );
        workflowTriggered = wf.ok;
        workflowFailed = !wf.ok;
        steps.push(
          wf.ok
            ? "workflow: solicitação aceita; entrega não comprovada"
            : `workflow: falhou (${wf.status})`,
        );
      } else {
        steps.push("workflow: não configurado");
      }
    } else {
      steps.push("workflow: não acionado; sem consentimento");
    }
    const ok = tagRes.ok && fieldsRes.ok && !workflowFailed;

    return {
      ok,
      ghlContactId: contactId,
      ghlAppointmentId: appointmentId,
      ghlOpportunityId: undefined,
      error: ok ? undefined : "Sincronização parcial: revise os passos que falharam.",
      workflowTriggered,
      steps,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      steps,
    };
  }
}
