/**
 * Fase 3 — chamadas HighLevel usadas pela orquestração de agendamento.
 * Server-only: usa GHL_TOKEN e nunca deve ser importado no cliente.
 */
import { GF_LOCATION_ID, normalizeEmail, normalizePhone } from "@/lib/linking";
import type { ContactCandidate } from "@/lib/booking-core";

const GHL_BASE = "https://services.leadconnectorhq.com";
const CONTACTS_VERSION = "2021-07-28";
const CALENDAR_VERSION = "2021-04-15";

interface GhlRes<T> {
  status: number;
  ok: boolean;
  data: T;
}

async function ghl<T = unknown>(
  path: string,
  init: { method: string; body?: unknown; version?: string },
): Promise<GhlRes<T>> {
  const token = process.env["GHL_TOKEN"];
  if (!token) throw new Error("GHL_TOKEN ausente no servidor");
  const res = await fetch(`${GHL_BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: init.version ?? CONTACTS_VERSION,
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

function mapContacts(rows: Array<Record<string, unknown>>): ContactCandidate[] {
  return rows.map((c) => ({
    id: String(c["id"] ?? ""),
    name:
      (c["contactName"] as string | undefined) ??
      ([c["firstName"], c["lastName"]].filter(Boolean).join(" ") || null),
    phone: (c["phone"] as string | undefined) ?? null,
    email: (c["email"] as string | undefined) ?? null,
  }));
}

/** Pesquisa por telefone normalizado e por e-mail, devolvendo candidatos únicos. */
export async function searchContactCandidates(params: {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
}): Promise<ContactCandidate[]> {
  const queries = [normalizePhone(params.phone), normalizeEmail(params.email)].filter(
    (q): q is string => Boolean(q),
  );
  if (queries.length === 0) {
    const name = params.name?.trim();
    if (name) queries.push(name);
  }
  const byId = new Map<string, ContactCandidate>();
  for (const query of queries) {
    const res = await ghl<{ contacts?: Array<Record<string, unknown>> }>("/contacts/search", {
      method: "POST",
      body: { locationId: GF_LOCATION_ID, pageLimit: 25, query },
    });
    if (!res.ok) continue;
    for (const c of mapContacts(res.data?.contacts ?? [])) {
      if (c.id) byId.set(c.id, c);
    }
  }
  return [...byId.values()];
}

export async function createGhlContact(params: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}): Promise<{ id: string | null; error?: string }> {
  const full = (params.name ?? "").trim();
  const [firstName, ...rest] = full.split(/\s+/).filter(Boolean);
  const res = await ghl<{ contact?: { id?: string }; message?: string }>("/contacts/", {
    method: "POST",
    body: {
      locationId: GF_LOCATION_ID,
      firstName: firstName ?? "Cliente",
      lastName: rest.join(" ") || undefined,
      phone: normalizePhone(params.phone) ?? undefined,
      email: normalizeEmail(params.email) ?? undefined,
    },
  });
  if (!res.ok) return { id: null, error: res.data?.message ?? `GHL ${res.status}` };
  return { id: res.data?.contact?.id ?? null };
}

export async function updateGhlContact(
  contactId: string,
  patch: Record<string, string>,
): Promise<boolean> {
  if (Object.keys(patch).length === 0) return true;
  const body: Record<string, unknown> = {};
  if (patch["name"]) {
    const [firstName, ...rest] = patch["name"].split(/\s+/).filter(Boolean);
    body["firstName"] = firstName;
    if (rest.length) body["lastName"] = rest.join(" ");
  }
  if (patch["phone"]) body["phone"] = patch["phone"];
  if (patch["email"]) body["email"] = patch["email"];
  const res = await ghl(`/contacts/${contactId}`, { method: "PUT", body });
  return res.ok;
}

/** Free-slots do calendário para a janela pedida (ISO strings). */
export async function fetchFreeSlots(
  calendarId: string,
  startMs: number,
  endMs: number,
  timezone = "Europe/Brussels",
): Promise<{ ok: boolean; slots: string[] }> {
  const qs = new URLSearchParams({
    startDate: String(startMs),
    endDate: String(endMs),
    timezone,
  });
  const res = await ghl<Record<string, unknown>>(
    `/calendars/${calendarId}/free-slots?${qs.toString()}`,
    { method: "GET", version: CALENDAR_VERSION },
  );
  if (!res.ok) return { ok: false, slots: [] };
  const slots: string[] = [];
  for (const [key, value] of Object.entries(res.data ?? {})) {
    if (key === "traceId" || !value || typeof value !== "object") continue;
    const list = (value as { slots?: unknown }).slots;
    if (Array.isArray(list)) slots.push(...list.map((s) => String(s)));
  }
  return { ok: true, slots };
}

export async function createGhlAppointment(params: {
  calendarId: string;
  contactId: string;
  startISO: string;
  endISO: string;
  title: string;
  notes?: string | null;
  status: "new" | "confirmed";
}): Promise<{ id: string | null; status: number; error?: string }> {
  const res = await ghl<{ id?: string; message?: string }>("/calendars/events/appointments", {
    method: "POST",
    version: CALENDAR_VERSION,
    body: {
      calendarId: params.calendarId,
      locationId: GF_LOCATION_ID,
      contactId: params.contactId,
      startTime: params.startISO,
      endTime: params.endISO,
      title: params.title,
      appointmentStatus: params.status,
      notes: params.notes ?? undefined,
      ignoreFreeSlotValidation: false,
    },
  });
  if (!res.ok) {
    return { id: null, status: res.status, error: res.data?.message ?? `GHL ${res.status}` };
  }
  return { id: res.data?.id ?? null, status: res.status };
}
