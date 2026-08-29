/**
 * Server-only HighLevel helpers for projetos/oportunidades.
 * Nunca importar deste ficheiro no cliente — usa GHL_TOKEN.
 */
import { GF_LOCATION_ID, GF_PIPELINE_ID, normalizeEmail, normalizePhone, samePhone } from "@/lib/linking";

const GHL_BASE = "https://services.leadconnectorhq.com";

export interface GhlResult<T = unknown> {
  status: number;
  ok: boolean;
  data: T;
}

async function ghl<T = unknown>(
  path: string,
  init: { method: string; body?: unknown; version?: string },
): Promise<GhlResult<T>> {
  const token = process.env.GHL_TOKEN;
  if (!token) throw new Error("GHL_TOKEN ausente no servidor");
  const res = await fetch(`${GHL_BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: init.version ?? "2021-07-28",
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data: data as T };
}

export interface GhlContactLite {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

/** Pesquisa contato existente por telefone/e-mail normalizados. */
export async function findGhlContact(params: {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
}): Promise<GhlContactLite | null> {
  const phone = normalizePhone(params.phone);
  const email = normalizeEmail(params.email);
  const query = email ?? phone ?? params.name?.trim() ?? "";
  if (!query) return null;

  const res = await ghl<{ contacts?: Array<Record<string, unknown>> }>("/contacts/search", {
    method: "POST",
    body: { locationId: GF_LOCATION_ID, pageLimit: 25, query },
  });
  if (!res.ok) return null;
  const rows = res.data?.contacts ?? [];
  const mapped: GhlContactLite[] = rows.map((c) => ({
    id: String(c["id"] ?? ""),
    name:
      (c["contactName"] as string | undefined) ??
      [c["firstName"], c["lastName"]].filter(Boolean).join(" ") ??
      null,
    phone: (c["phone"] as string | undefined) ?? null,
    email: (c["email"] as string | undefined) ?? null,
  }));

  if (email) {
    const hit = mapped.find((c) => normalizeEmail(c.email) === email);
    if (hit) return hit;
  }
  if (phone) {
    const hit = mapped.find((c) => samePhone(c.phone, phone));
    if (hit) return hit;
  }
  return mapped[0] ?? null;
}

export interface GhlOpportunityLite {
  id: string;
  name: string | null;
  status: string | null;
  pipelineId: string | null;
  pipelineStageId: string | null;
  monetaryValue: number | null;
}

/** Oportunidades abertas do contato no pipeline oficial. */
export async function findOpenOpportunities(contactId: string): Promise<GhlOpportunityLite[]> {
  const qs = new URLSearchParams({
    location_id: GF_LOCATION_ID,
    contact_id: contactId,
    pipeline_id: GF_PIPELINE_ID,
    status: "open",
    limit: "20",
  });
  const res = await ghl<{ opportunities?: Array<Record<string, unknown>> }>(
    `/opportunities/search?${qs.toString()}`,
    { method: "GET" },
  );
  if (!res.ok) return [];
  return (res.data?.opportunities ?? []).map((o) => ({
    id: String(o["id"] ?? ""),
    name: (o["name"] as string | undefined) ?? null,
    status: (o["status"] as string | undefined) ?? null,
    pipelineId: (o["pipelineId"] as string | undefined) ?? null,
    pipelineStageId: (o["pipelineStageId"] as string | undefined) ?? null,
    monetaryValue:
      o["monetaryValue"] == null ? null : Number(o["monetaryValue"] as number | string),
  }));
}

let cachedStageId: { at: number; id: string | null } | null = null;

/** Primeiro estágio do pipeline oficial (cacheado 10 min). */
export async function firstPipelineStageId(): Promise<string | null> {
  if (cachedStageId && Date.now() - cachedStageId.at < 10 * 60_000) return cachedStageId.id;
  const res = await ghl<{ pipelines?: Array<Record<string, unknown>> }>(
    `/opportunities/pipelines?locationId=${GF_LOCATION_ID}`,
    { method: "GET" },
  );
  let id: string | null = null;
  if (res.ok) {
    const pipe = (res.data?.pipelines ?? []).find((p) => String(p["id"]) === GF_PIPELINE_ID);
    const stages = (pipe?.["stages"] as Array<Record<string, unknown>> | undefined) ?? [];
    id = stages.length > 0 ? String(stages[0]!["id"]) : null;
  }
  cachedStageId = { at: Date.now(), id };
  return id;
}

/**
 * Cria oportunidade no pipeline oficial. Só é chamada após confirmação
 * explícita do utilizador — nunca automaticamente e nunca em outro pipeline.
 */
export async function createOpportunity(params: {
  contactId: string;
  name: string;
  monetaryValue?: number;
}): Promise<{ id: string | null; error?: string }> {
  const stageId = await firstPipelineStageId();
  const res = await ghl<{ opportunity?: { id?: string }; id?: string; message?: string }>(
    "/opportunities/",
    {
      method: "POST",
      body: {
        pipelineId: GF_PIPELINE_ID,
        locationId: GF_LOCATION_ID,
        contactId: params.contactId,
        name: params.name,
        status: "open",
        monetaryValue: params.monetaryValue ?? 0,
        ...(stageId ? { pipelineStageId: stageId } : {}),
      },
    },
  );
  if (!res.ok) {
    return { id: null, error: res.data?.message ?? `GHL ${res.status}` };
  }
  return { id: res.data?.opportunity?.id ?? res.data?.id ?? null };
}
