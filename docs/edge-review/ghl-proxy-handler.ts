// REVIEW ONLY: outside supabase/functions to prevent automatic deployment.
// Auth/role reads use the caller's RLS client; never a privileged role lookup.
export const GF_LOCATION = "9iqrKUVPDddINb9S4Iwd";
const BASE = "https://services.leadconnectorhq.com";
type Row = Record<string, unknown>;
type Result = { data: Row | null; error: unknown };
export interface ProxyClient {
  auth: { getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  from(table: string): { select(fields: string): { eq(key: string, value: string): { maybeSingle(): Promise<Result> } } };
}
export interface ProxyDeps {
  env(name: string): string | undefined;
  client(url: string, key: string, auth: string): ProxyClient;
  fetch: typeof fetch;
}
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
function json(status: number, data: unknown) { return Response.json(data, { status, headers: { ...cors, "Cache-Control": "private, no-store" } }); }
function object(v: unknown): v is Row { return !!v && typeof v === "object" && !Array.isArray(v); }
function locationsValid(v: unknown): boolean {
  if (Array.isArray(v)) return v.every(locationsValid);
  if (!object(v)) return true;
  return Object.entries(v).every(([key, value]) => (key === "locationId" || key === "location_id") ? value === GF_LOCATION : locationsValid(value));
}
const ID = "([A-Za-z0-9_-]+)";
export function createProxyHandler(d: ProxyDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
    const token = d.env("GHL_TOKEN"), url = d.env("SUPABASE_URL");
    const key = d.env("SUPABASE_ANON_KEY") || d.env("SUPABASE_PUBLISHABLE_KEY");
    if (!token || !url || !key) return json(503, { error: "configuration_missing" });
    const auth = req.headers.get("authorization") ?? "";
    const bearer = /^Bearer ([^\s]+)$/.exec(auth)?.[1];
    if (!bearer || bearer === key || bearer === token || bearer.startsWith("sb_publishable_") || bearer.startsWith("sb_secret_")) return json(401, { error: "unauthorized" });
    try {
      const client = d.client(url, key, auth);
      const identity = await client.auth.getUser();
      if (identity.error || !identity.data.user) return json(401, { error: "unauthorized" });
      const profile = await client.from("app_users").select("role,artist_id").eq("id", identity.data.user.id).maybeSingle();
      if (profile.error || !profile.data || !["admin", "artist"].includes(String(profile.data.role))) return json(403, { error: "forbidden" });
      let p: unknown;
      try { p = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
      if (!object(p) || typeof p.path !== "string" || !/^\/[A-Za-z0-9_/-]+$/.test(p.path) || p.path.includes("//")) return json(400, { error: "invalid_path" });
      if (!locationsValid(p)) return json(403, { error: "location_forbidden" });
      if (p.query !== undefined && !object(p.query) || p.body !== undefined && !object(p.body)) return json(400, { error: "invalid_payload" });
      const query = { ...(object(p.query) ? p.query : {}) };
      const body = { ...(object(p.body) ? p.body : {}) };
      const method = typeof p.method === "string" ? p.method.toUpperCase() : "GET";
      const path = p.path;
      const free = new RegExp(`^/calendars/${ID}/free-slots$`).exec(path);
      const detail = new RegExp(`^/contacts/${ID}$`).exec(path);
      const isEvents = method === "GET" && path === "/calendars/events";
      const isFree = method === "GET" && !!free;
      const isContact = method === "GET" && !!detail;
      const isCreateAppt = method === "POST" && path === "/calendars/events/appointments";
      const isSearch = method === "POST" && path === "/contacts/search";
      const isCreateContact = method === "POST" && path === "/contacts/";
      const isPipelines = method === "GET" && path === "/opportunities/pipelines";
      const isOppSearch = method === "GET" && path === "/opportunities/search";
      const isOppCreate = method === "POST" && path === "/opportunities/";
      const isCatalog = method === "GET" && path === "/calendars/";
      if (!(isEvents || isFree || isContact || isCreateAppt || isSearch || isCreateContact || isPipelines || isOppSearch || isOppCreate || isCatalog)) return json(403, { error: "operation_forbidden" });
      const calendar = free?.[1] ?? query.calendarId ?? body.calendarId;
      // Reject aliases/conflicting IDs rather than letting upstream choose one.
      const declared = [free?.[1], query.calendarId, query.calendar_id, body.calendarId, body.calendar_id].filter(v => v !== undefined);
      if (declared.some(v => typeof v !== "string" || v !== calendar)) return json(403, { error: "calendar_forbidden" });
      if ((isEvents || isFree || isCreateAppt) && (typeof calendar !== "string" || !calendar)) return json(403, { error: "calendar_required" });
      const role = profile.data.role;
      if (role === "artist") {
        if (typeof profile.data.artist_id !== "string") return json(403, { error: "unlinked" });
        const a = await client.from("artists").select("id,active,ghl_calendar_id,ghl_user_id").eq("id", profile.data.artist_id).maybeSingle();
        if (a.error || !a.data || a.data.active !== true || typeof a.data.ghl_calendar_id !== "string" || !a.data.ghl_calendar_id || typeof a.data.ghl_user_id !== "string" || !a.data.ghl_user_id) return json(403, { error: "unlinked" });
        // No location-wide contact/opportunity discovery, writes or guessed IDs.
        // Contact detail is denied until an independently proven per-contact scope exists.
        if (!(isEvents || isFree) || calendar !== a.data.ghl_calendar_id) return json(403, { error: "scope_forbidden" });
        const permitted = isEvents ? ["calendarId", "locationId", "startTime", "endTime"] : ["startDate", "endDate", "timezone", "locationId"];
        if (Object.keys(query).some(k => !permitted.includes(k)) || Object.keys(body).length) return json(403, { error: "scope_forbidden" });
      }
      // Every entity-ID route is verified against GF BEFORE a read/write.
      async function verify(path: string, envelope: string, id: string) {
        const r = await d.fetch(BASE + path, { headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28" }, signal: AbortSignal.timeout(15_000), redirect: "error" });
        if (!r.ok) return false;
        const value: unknown = await r.json(); const row = object(value) ? value[envelope] : null;
        return object(row) && row.id === id && row.locationId === GF_LOCATION;
      }
      if (typeof calendar === "string" && !await verify(`/calendars/${calendar}`, "calendar", calendar)) return json(403, { error: "calendar_forbidden" });
      const contact = detail?.[1] ?? (isCreateAppt || isOppCreate ? body.contactId : undefined);
      if ((isContact || isCreateAppt || isOppCreate) && (typeof contact !== "string" || !contact || !await verify(`/contacts/${contact}`, "contact", contact))) return json(403, { error: "contact_forbidden" });
      if (method === "GET") query.locationId = GF_LOCATION;
      else body.locationId = GF_LOCATION;
      const upstreamUrl = new URL(BASE + path);
      for (const [k, v] of Object.entries(query)) {
        if (v === null || v === undefined) continue;
        if (!["string", "number", "boolean"].includes(typeof v)) return json(400, { error: "invalid_query" });
        upstreamUrl.searchParams.set(k, String(v));
      }
      const version = p.version === "2021-04-15" || p.version === "2021-07-28" ? p.version : "2021-07-28";
      const r = await d.fetch(upstreamUrl, { method, headers: { Authorization: `Bearer ${token}`, Version: version, "Content-Type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000), redirect: "error" });
      const data: unknown = await r.json();
      if (role === "artist") {
        if (isEvents) {
          const events = object(data) ? data.events : null;
          if (!Array.isArray(events) || events.some(e => !object(e) || e.calendarId !== calendar || (e.locationId !== undefined && e.locationId !== GF_LOCATION))) return json(502, { error: "invalid_scoped_response" });
        } else if (!object(data)) return json(502, { error: "invalid_scoped_response" });
      }
      return json(200, { status: r.status, ok: r.ok, data });
    } catch { return json(502, { error: "verification_or_upstream_failed" }); }
  };
}