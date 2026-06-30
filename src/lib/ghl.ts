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
  const { data, error } = await supabase.functions.invoke("ghl-proxy", { body: params });
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
      filters: query
        ? [
            {
              field: "searchAfter",
              operator: "contains",
              value: query,
            },
          ]
        : [],
      // Fallback simple search if filter shape isn't supported
      query,
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
    body: input,
  });
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