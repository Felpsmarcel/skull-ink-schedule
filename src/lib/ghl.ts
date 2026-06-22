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