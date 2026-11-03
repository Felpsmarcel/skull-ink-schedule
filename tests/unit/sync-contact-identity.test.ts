import { beforeEach, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({
  mode: "lookup" as "lookup" | "foreign" | "upsert" | "divergent" | "valid",
  writes: [] as Array<{ kind: string; rows: unknown[] }>,
  prior: {} as Record<string, unknown>,
  finish: {} as Record<string, unknown>,
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  rpc: (name: string, args: Record<string, unknown>) => ({ abortSignal: async () => {
    if (name === "ghl_sync_begin") return { data: true, error: null };
    if (name === "ghl_sync_finish") { f.finish = args.p_result as Record<string, unknown>; return { data: null, error: null }; }
    const kind = String(args.p_kind); const rows = args.p_rows as unknown[];
    f.writes.push({ kind, rows });
    if (kind === "contacts") return f.mode === "upsert" ? { data: null, error: { message: "fictional failure" } } : { data: [{ id: "local-B", ghl_contact_id: "B" }], error: null };
    if (kind === "update") Object.assign(f.prior, rows[0]);
    return { data: rows, error: null };
  } }),
  from: (table: string) => {
    const q = {
      select: (_fields: string) => q, eq: (_key: string, _value: unknown) => q,
      in: (_key: string, _ids: unknown[]) => q,
      abortSignal: async () => ({ data: table === "artists" ? [{ id: "artist", active: true, ghl_calendar_id: "cal", commission_pct: 37 }]
        : table === "contacts" ? [] : [{ ...f.prior }], error: null }),
    }; return q;
  },
} }));
vi.mock("@/lib/observability.server", () => ({ logIncident: vi.fn() }));
import { syncGhlAppointments } from "../../src/lib/sync.server";

beforeEach(() => {
  f.writes = []; f.finish = {};
  f.prior = { ghl_appointment_id: "event", artist_id: "artist", calendar_id: "cal", ghl_contact_id: "A", contact_id: "local-A", contact_name: "Fictional A", contact_email: "a@example.test", contact_phone: "old", start_at: "2026-11-03T10:00:00Z", end_at: "2026-11-03T11:00:00Z", status: "pending" };
  vi.stubEnv("GHL_TOKEN", "fictional-test");
  vi.stubGlobal("fetch", vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.includes("/contacts/")) return f.mode === "lookup" ? new Response("", { status: 503 }) : Response.json({ contact: { id: "B", locationId: f.mode === "foreign" ? "other-location" : "9iqrKUVPDddINb9S4Iwd", name: "Fictional B", email: null, phone: null } });
    if (url.includes("/calendars/events")) return Response.json({ events: [{ id: "event", calendarId: "cal", contactId: "B", contact: { id: f.mode === "divergent" ? "C" : "B" }, startTime: "2026-11-03T12:00:00Z", endTime: "2026-11-03T13:00:00Z", appointmentStatus: "confirmed" }] });
    return Response.json({ calendars: [{ id: "cal" }] });
  }));
});
for (const mode of ["lookup", "foreign", "upsert", "divergent"] as const) {
  it(`A→B preserves ALL prior fields and fails on ${mode}`, async () => {
    f.mode = mode; const before = { ...f.prior };
    const result = await syncGhlAppointments();
    expect(f.writes.filter(w => w.kind === "insert" || w.kind === "update")).toEqual([]);
    expect(f.prior).toEqual(before); expect(result.ok).toBe(false); expect(result.failures).toBeGreaterThan(0);
    expect(f.finish.ok).toBe(false);
  });
}