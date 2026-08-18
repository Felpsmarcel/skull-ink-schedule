import { supabase } from "@/integrations/supabase/client";

export interface GhlFetchParams {
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  version?: string;
}

export interface GhlFetchResult<T = unknown> {
  status: number;
  ok: boolean;
  data: T;
  url?: string;
}

export async function ghlFetch<T = unknown>(params: GhlFetchParams): Promise<GhlFetchResult<T>> {
  // Garante um access token válido: a sessão em cache pode estar expirada,
  // e o proxy responde 401 "JWT inválido" nesse caso.
  let token = (await supabase.auth.getSession()).data.session?.access_token ?? null;
  if (!token) {
    token = (await supabase.auth.refreshSession()).data.session?.access_token ?? null;
  }
  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente para usar a integração GHL.");
  }
  const { data, error } = await supabase.functions.invoke("ghl-proxy", {
    body: params,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw new Error(`ghl-proxy invoke error: ${error.message}`);
  return data as GhlFetchResult<T>;
}

const GHL_VERSION = "2021-04-15";

// Free-slots: GHL returns a map keyed by YYYY-MM-DD with { slots: ISO[] } values.
export interface FreeSlotsResponse {
  [date: string]: { slots?: string[] } | string | undefined;
  traceId?: string;
}

export async function getFreeSlots(
  calendarId: string,
  startMs: number,
  endMs: number,
  timezone = "Europe/Brussels",
) {
  return ghlFetch<FreeSlotsResponse>({
    path: `/calendars/${calendarId}/free-slots`,
    method: "GET",
    version: GHL_VERSION,
    query: { startDate: startMs, endDate: endMs, timezone },
  });
}

export interface GhlEvent {
  id: string;
  calendarId?: string;
  contactId?: string;
  title?: string;
  appointmentStatus?: string;
  startTime: string;
  endTime: string;
  assignedUserId?: string;
  // GHL sometimes inlines contact info
  contact?: { id?: string; name?: string; firstName?: string; lastName?: string };
}

export interface EventsResponse {
  events?: GhlEvent[];
  traceId?: string;
}

export async function getEvents(
  calendarId: string,
  startMs: number,
  endMs: number,
  locationId: string,
) {
  return ghlFetch<EventsResponse>({
    path: `/calendars/events`,
    method: "GET",
    version: GHL_VERSION,
    query: {
      calendarId,
      locationId,
      startTime: startMs,
      endTime: endMs,
    },
  });
}

/* --------------------- Contacts --------------------- */

const CONTACTS_VERSION = "2021-07-28";

export interface GhlContact {
  id: string;
  contactName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  locationId?: string;
}

export interface ContactsSearchResponse {
  contacts?: GhlContact[];
  total?: number;
  traceId?: string;
}

export async function searchContacts(locationId: string, query: string) {
  return ghlFetch<ContactsSearchResponse>({
    path: "/contacts/search",
    method: "POST",
    version: CONTACTS_VERSION,
    body: {
      locationId,
      pageLimit: 25,
      // Top-level `query` is GHL's free-text search across name/email/phone.
      // Do NOT use `searchAfter` as a filter field — it's a pagination cursor
      // and causes 400 "Invalid field searchAfter".
      query: query || undefined,
    },
  });
}

export interface CreateContactInput {
  locationId: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

export interface CreateContactResponse {
  contact?: GhlContact;
  traceId?: string;
}

export async function createContact(input: CreateContactInput) {
  return ghlFetch<CreateContactResponse>({
    path: "/contacts/",
    method: "POST",
    version: CONTACTS_VERSION,
    body: {
      ...input,
      firstName: input.firstName.trim(),
      lastName: input.lastName?.trim() || undefined,
      phone: input.phone ? sanitizePhone(input.phone) : undefined,
      email: input.email?.trim() || undefined,
    },
  });
}

/**
 * Remove caracteres invisíveis (bidi/zero-width) que iOS injeta em números
 * com "+", normaliza espaços e converte prefixo "00" para "+". Sem eles o
 * GHL rejeita com "Invalid country calling code".
 */
export function sanitizePhone(raw: string): string {
  let s = raw.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  if (/^00\d/.test(s.replace(/\s/g, ""))) s = "+" + s.replace(/^\s*00/, "");
  return s;
}

export interface GhlContactDetail extends GhlContact {
  source?: string;
  tags?: string[];
  assignedTo?: string;
}

export interface GetContactResponse {
  contact?: GhlContactDetail;
  traceId?: string;
}

export async function getContact(contactId: string) {
  return ghlFetch<GetContactResponse>({
    path: `/contacts/${contactId}`,
    method: "GET",
    version: CONTACTS_VERSION,
  });
}

/* --------------------- Appointments --------------------- */

export interface CreateAppointmentInput {
  calendarId: string;
  locationId: string;
  contactId: string;
  startTime: string; // ISO
  endTime: string; // ISO
  title?: string;
  appointmentStatus?: "confirmed" | "new" | "showed" | "noshow" | "cancelled" | "invalid";
  notes?: string;
  ignoreFreeSlotValidation?: boolean;
}

export interface CreateAppointmentResponse {
  id?: string;
  calendarId?: string;
  contactId?: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  appointmentStatus?: string;
  traceId?: string;
  message?: string;
}

export async function createAppointment(input: CreateAppointmentInput) {
  const {
    calendarId,
    locationId,
    contactId,
    startTime,
    endTime,
    title,
    appointmentStatus = "confirmed",
    notes,
    ignoreFreeSlotValidation = false,
  } = input;
  return ghlFetch<CreateAppointmentResponse>({
    path: "/calendars/events/appointments",
    method: "POST",
    version: GHL_VERSION,
    body: {
      calendarId,
      locationId,
      contactId,
      startTime,
      endTime,
      title,
      appointmentStatus,
      notes,
      ignoreFreeSlotValidation,
    },
  });
}