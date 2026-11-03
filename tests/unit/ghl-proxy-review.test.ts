import { beforeEach, expect, it, vi } from "vitest";
import { createProxyHandler, GF_LOCATION, type ProxyDeps } from "../../docs/edge-review/ghl-proxy-handler";
let role: string, jwtOk: boolean, artistCalendar: string | null;
const upstream = vi.fn<typeof fetch>();
let env: Record<string, string>;
const deps: ProxyDeps = {
  env: k => env[k], fetch: upstream,
  client: () => ({ auth: { getUser: async () => ({ data: { user: jwtOk ? { id: "user" } : null }, error: null }) },
    from: t => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: t === "app_users" ? { role, artist_id: "A" } : { id: "A", active: true, ghl_calendar_id: artistCalendar, ghl_user_id: "crm-user-A" }, error: null }) }) }) }),
  }),
};
function request(p: unknown, token: string | null = "fictional-session") { return new Request("https://example.test/proxy", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(p) }); }
const events = { path: "/calendars/events", query: { calendarId: "cal-A", locationId: GF_LOCATION, startTime: 1, endTime: 2 } };
beforeEach(() => { role = "artist"; jwtOk = true; artistCalendar = "cal-A"; env = { GHL_TOKEN: "fictional-ghl", SUPABASE_URL: "https://example.test", SUPABASE_ANON_KEY: "fictional-public" }; upstream.mockReset(); upstream.mockImplementation(async (url) => String(url).endsWith("/calendars/cal-A") ? Response.json({ calendar: { id: "cal-A", locationId: GF_LOCATION } }) : Response.json({ events: [{ id: "evt-A", calendarId: "cal-A" }] })); });
it("OPTIONS permits all invoke headers without authentication or upstream calls", async () => {
  const client = vi.fn(deps.client);
  const requestedHeaders = ["Authorization", "apikey", "content-type", "x-client-info"];
  const response = await createProxyHandler({ ...deps, client })(new Request("https://example.test/proxy", {
    method: "OPTIONS",
    headers: {
      Origin: "https://frontend.example.test",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": requestedHeaders.join(", "),
    },
  }));
  expect(response.status).toBe(204);
  expect(await response.text()).toBe("");
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(response.headers.get("Access-Control-Allow-Methods")?.split(",").map(v => v.trim())).toContain("POST");
  const allowed = response.headers.get("Access-Control-Allow-Headers")?.toLowerCase().split(",").map(v => v.trim());
  for (const header of requestedHeaders) expect(allowed).toContain(header.toLowerCase());
  expect(client).not.toHaveBeenCalled();
  expect(upstream).not.toHaveBeenCalled();
});
it("no token never reaches upstream", async () => { expect((await createProxyHandler(deps)(request(events, null))).status).toBe(401); expect(upstream).not.toHaveBeenCalled(); });
it("public key is not identity", async () => { expect((await createProxyHandler(deps)(request(events, "fictional-public"))).status).toBe(401); expect(upstream).not.toHaveBeenCalled(); });
it("invalid JWT is denied", async () => { jwtOk = false; expect((await createProxyHandler(deps)(request(events))).status).toBe(401); expect(upstream).not.toHaveBeenCalled(); });
for (const key of ["GHL_TOKEN", "SUPABASE_URL", "SUPABASE_ANON_KEY"]) it(`missing ${key} fails closed`, async () => { delete env[key]; expect((await createProxyHandler(deps)(request(events))).status).toBe(503); expect(upstream).not.toHaveBeenCalled(); });
it("unknown role fails closed", async () => { role = "unknown"; expect((await createProxyHandler(deps)(request(events))).status).toBe(403); expect(upstream).not.toHaveBeenCalled(); });
it("events without calendar denied", async () => { expect((await createProxyHandler(deps)(request({ path: events.path }))).status).toBe(403); expect(upstream).not.toHaveBeenCalled(); });
it("unlinked artist denied", async () => { artistCalendar = null; expect((await createProxyHandler(deps)(request(events))).status).toBe(403); expect(upstream).not.toHaveBeenCalled(); });
it("other artist calendar denied", async () => { expect((await createProxyHandler(deps)(request({ ...events, query: { calendarId: "cal-B" } }))).status).toBe(403); expect(upstream).not.toHaveBeenCalled(); });
for (const path of ["/contacts/search", "/contacts/B", "/opportunities/search"]) it(`artist unscoped ${path} denied`, async () => { expect((await createProxyHandler(deps)(request({ path, method: path.endsWith('/search') && path.startsWith('/contacts') ? "POST" : "GET" }))).status).toBe(403); expect(upstream).not.toHaveBeenCalled(); });
it("other location denied even for admin", async () => { role = "admin"; expect((await createProxyHandler(deps)(request({ ...events, query: { calendarId: "cal-A", locationId: "other" } }))).status).toBe(403); expect(upstream).not.toHaveBeenCalled(); });
it("calendar verification requires exact GF location", async () => { upstream.mockResolvedValue(Response.json({ calendar: { id: "cal-A", locationId: "other" } })); expect((await createProxyHandler(deps)(request(events))).status).toBe(403); expect(upstream).toHaveBeenCalledTimes(1); });
it("verified own calendar works", async () => { expect((await createProxyHandler(deps)(request(events))).status).toBe(200); expect(upstream).toHaveBeenCalledTimes(2); });
it("foreign event in response is rejected", async () => { upstream.mockImplementation(async url => String(url).endsWith('/calendars/cal-A') ? Response.json({ calendar: { id: "cal-A", locationId: GF_LOCATION } }) : Response.json({ events: [{ calendarId: "cal-B" }] })); expect((await createProxyHandler(deps)(request(events))).status).toBe(502); });
for (const [path, method] of [["/contacts/search", "POST"], ["/contacts/", "POST"], ["/opportunities/search", "GET"], ["/opportunities/pipelines", "GET"]]) it(`admin retains ${path} fixed to GF`, async () => { role = "admin"; const r = await createProxyHandler(deps)(request({ path, method })); expect(r.status).toBe(200); const [url, options] = upstream.mock.calls[0]; if (method === "GET") expect(new URL(String(url)).searchParams.get("locationId")).toBe(GF_LOCATION); else expect(JSON.parse(String(options?.body)).locationId).toBe(GF_LOCATION); });
it("admin appointment creation verifies calendar and contact first", async () => {
  role = "admin";
  upstream.mockImplementation(async url => String(url).endsWith('/calendars/cal-A') ? Response.json({ calendar: { id: "cal-A", locationId: GF_LOCATION } }) : String(url).endsWith('/contacts/contact-A') ? Response.json({ contact: { id: "contact-A", locationId: GF_LOCATION } }) : Response.json({ id: "new-event" }));
  const r = await createProxyHandler(deps)(request({ path: "/calendars/events/appointments", method: "POST", body: { calendarId: "cal-A", contactId: "contact-A" } }));
  expect(r.status).toBe(200); expect(upstream).toHaveBeenCalledTimes(3);
  expect(JSON.parse(String(upstream.mock.calls[2][1]?.body)).locationId).toBe(GF_LOCATION);
});
it("admin foreign contact is rejected before appointment creation", async () => {
  role = "admin"; upstream.mockImplementation(async url => String(url).endsWith('/calendars/cal-A') ? Response.json({ calendar: { id: "cal-A", locationId: GF_LOCATION } }) : Response.json({ contact: { id: "contact-A", locationId: "other" } }));
  expect((await createProxyHandler(deps)(request({ path: "/calendars/events/appointments", method: "POST", body: { calendarId: "cal-A", contactId: "contact-A" } }))).status).toBe(403);
  expect(upstream).toHaveBeenCalledTimes(2);
});
it("artist cannot change requested calendar through body or alias", async () => {
  for (const p of [{ ...events, body: { calendarId: "cal-B" } }, { ...events, query: { ...events.query, calendar_id: "cal-B" } }]) expect((await createProxyHandler(deps)(request(p))).status).toBe(403);
  expect(upstream).not.toHaveBeenCalled();
});
it("no payload, token or upstream sample is logged", async () => {
  const log = vi.spyOn(console, "log"), error = vi.spyOn(console, "error");
  try { await createProxyHandler(deps)(request(events)); expect(log).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled(); } finally { log.mockRestore(); error.mockRestore(); }
});