// Server-only. Sincroniza um check-in do totem com o HighLevel.
// Best-effort: qualquer falha aqui NÃO desfaz o registo local do check-in.
//
// Ordem: contacto → agendamento do dia → oportunidade → tag → campos → workflow.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GHL_BASE = "https://services.leadconnectorhq.com";
const V_CONTACTS = "2021-07-28";
const V_CALENDARS = "2021-04-15";
export const CHECKIN_LOCATION_ID = "9iqrKUVPDddINb9S4Iwd";
export const CHECKIN_TAG = "check-in-totem-gf";
export const STATUS_AGUARDANDO = "Aguardando atendimento";

export interface CheckinSyncInput {
  checkinId: string;
  clienteNome: string;
  clienteTelefone: string | null;
  clienteEmail?: string | null;
  ghlContactId: string | null;
  codigoAtendimento: string;
  qrUrl: string;
  arrivedAtISO: string;
}

export interface CheckinSyncResult {
  ok: boolean;
  ghlContactId?: string;
  ghlAppointmentId?: string;
  ghlOpportunityId?: string;
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
  const { data } = await supabaseAdmin
    .from("app_settings" as never)
    .select("value")
    .eq("key", key)
    .maybeSingle();
  const value = (data as { value?: { id?: string } } | null)?.value;
  return value?.id ?? null;
}

/** Localiza contacto por telefone; cria apenas se não existir. */
async function findOrCreateContact(
  token: string,
  input: CheckinSyncInput,
  steps: string[],
): Promise<string | null> {
  if (input.ghlContactId) {
    steps.push("contacto: já conhecido");
    return input.ghlContactId;
  }

  if (input.clienteTelefone) {
    const search = await call(
      "/contacts/search",
      {
        method: "POST",
        body: JSON.stringify({
          locationId: CHECKIN_LOCATION_ID,
          pageLimit: 5,
          query: input.clienteTelefone,
        }),
      },
      token,
    );
    const found = (search.body as { contacts?: Array<{ id?: string }> } | null)?.contacts?.[0]?.id;
    if (found) {
      steps.push("contacto: encontrado por telefone");
      return found;
    }
  }

  const parts = input.clienteNome.trim().split(/\s+/);
  const created = await call(
    "/contacts/",
    {
      method: "POST",
      body: JSON.stringify({
        locationId: CHECKIN_LOCATION_ID,
        firstName: parts[0] ?? input.clienteNome,
        lastName: parts.slice(1).join(" ") || undefined,
        phone: input.clienteTelefone || undefined,
        email: input.clienteEmail || undefined,
        source: "Totem GF",
      }),
    },
    token,
  );
  const id = (created.body as { contact?: { id?: string } } | null)?.contact?.id ?? null;
  steps.push(id ? "contacto: criado" : `contacto: falhou (${created.status})`);
  return id;
}

/** Agendamento do contacto para hoje (fuso de Bruxelas). */
async function findTodayAppointment(
  token: string,
  contactId: string,
  steps: string[],
): Promise<{ id: string; startTime?: string; calendarId?: string } | null> {
  const res = await call(`/contacts/${contactId}/appointments`, { method: "GET" }, token, V_CALENDARS);
  const events = (res.body as { events?: Array<Record<string, unknown>> } | null)?.events ?? [];
  const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" });
  const match = events.find((e) => {
    const start = typeof e.startTime === "string" ? e.startTime : null;
    if (!start) return false;
    return new Date(start).toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" }) === todayKey;
  });
  steps.push(match ? "agendamento: encontrado para hoje" : "agendamento: nenhum hoje");
  if (!match) return null;
  return {
    id: String(match.id),
    startTime: typeof match.startTime === "string" ? match.startTime : undefined,
    calendarId: typeof match.calendarId === "string" ? match.calendarId : undefined,
  };
}

/** Reutiliza a oportunidade aberta do contacto; não cria duplicados. */
async function findOpportunity(
  token: string,
  contactId: string,
  steps: string[],
): Promise<string | null> {
  const res = await call(
    `/opportunities/search?location_id=${CHECKIN_LOCATION_ID}&contact_id=${contactId}&limit=5`,
    { method: "GET" },
    token,
  );
  const list = (res.body as { opportunities?: Array<{ id?: string }> } | null)?.opportunities ?? [];
  const id = list[0]?.id ?? null;
  steps.push(id ? "oportunidade: reutilizada" : "oportunidade: nenhuma encontrada");
  return id;
}

export async function syncCheckinToGhl(input: CheckinSyncInput): Promise<CheckinSyncResult> {
  const steps: string[] = [];
  const token = process.env.GHL_TOKEN;
  if (!token) return { ok: false, error: "GHL_TOKEN ausente", steps };

  try {
    const contactId = await findOrCreateContact(token, input, steps);
    if (!contactId) return { ok: false, error: steps.join(" | "), steps };

    const appointment = await findTodayAppointment(token, contactId, steps);
    const opportunityId = await findOpportunity(token, contactId, steps);

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

    // Workflow de confirmação (opcional; só corre se o ID estiver configurado)
    const workflowId = await getSetting("ghl_checkin_workflow_id");
    if (workflowId) {
      const wf = await call(
        `/contacts/${contactId}/workflow/${workflowId}`,
        { method: "POST", body: JSON.stringify({ eventStartTime: input.arrivedAtISO }) },
        token,
      );
      steps.push(wf.ok ? "workflow: acionado" : `workflow: falhou (${wf.status})`);
    } else {
      steps.push("workflow: não configurado");
    }

    return {
      ok: true,
      ghlContactId: contactId,
      ghlAppointmentId: appointment?.id,
      ghlOpportunityId: opportunityId ?? undefined,
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
