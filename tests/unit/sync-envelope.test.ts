import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ calls: [] as string[], events: {} as unknown }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  rpc: (name: string) => { f.calls.push(name); return { abortSignal: async () => ({ data: name === "ghl_sync_begin" ? true : null, error: null }) }; },
  from: () => ({ select: () => ({ eq: () => ({ abortSignal: async () => ({ data: [{ id: "a", ghl_calendar_id: "cal", active: true, commission_pct: 37 }], error: null }) }) }), insert: async () => ({ error: null }) }),
} }));
vi.mock("@/lib/observability.server", () => ({ logIncident: vi.fn() }));
import { syncGhlAppointments, backfillContactNames } from "../../src/lib/sync.server";
beforeEach(() => { f.calls = []; vi.stubEnv("GHL_TOKEN", "fictional"); vi.stubGlobal("fetch", vi.fn(async (url: unknown) => Response.json(String(url).includes('/events') ? f.events : { calendars: [{ id: "cal", locationId: "9iqrKUVPDddINb9S4Iwd" }] }))); });
for (const envelope of [null, {}, { events: null }, { events: {} }, { events: [null] }, { events: [{ id: "x", startTime: "bad", endTime: "bad" }] }]) {
  it(`HTTP 200 invalid events ${JSON.stringify(envelope)} fails`, async () => { f.events = envelope; expect((await syncGhlAppointments()).ok).toBe(false); expect(f.calls).not.toContain("ghl_sync_write"); });
}
it("backfill is disabled before any read or upstream call", async () => { await expect(backfillContactNames()).rejects.toThrow("desativado"); expect(f.calls).toEqual([]); expect(fetch).not.toHaveBeenCalled(); });