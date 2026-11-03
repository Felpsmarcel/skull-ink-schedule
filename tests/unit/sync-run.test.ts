import { beforeEach, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  calls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  artists: [] as unknown[],
  acquired: true,
  finishError: false,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: (name: string, args: Record<string, unknown>) => {
      fake.calls.push({ name, args });
      return { abortSignal: async () => ({
        data: name === "ghl_sync_begin" ? fake.acquired : null,
        error: name === "ghl_sync_finish" && fake.finishError ? { message: "fictional failure" } : null,
      }) };
    },
    from: () => ({ select: () => ({ eq: () => ({ abortSignal: async () => ({ data: fake.artists, error: null }) }) }) }),
  },
}));
vi.mock("@/lib/observability.server", () => ({ logIncident: vi.fn() }));
import { syncGhlAppointments } from "../../src/lib/sync.server";

beforeEach(() => {
  fake.calls = []; fake.artists = []; fake.acquired = true; fake.finishError = false;
  vi.stubEnv("GHL_TOKEN", "fictional-test-credential");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ calendars: [{ id: "cal-a" }], events: [] })));
});
it("a blocked run never calls CRM or marks itself completed", async () => {
  fake.acquired = false;
  await expect(syncGhlAppointments()).rejects.toThrow("bloqueada");
  expect(fetch).not.toHaveBeenCalled();
  expect(fake.calls.map(c => c.name)).toEqual(["ghl_sync_begin"]);
});
it("zero configured calendars is a failure, not a zero-count success", async () => {
  const result = await syncGhlAppointments();
  expect(result.ok).toBe(false); expect(result.failures).toBe(1);
  expect(fake.calls[1].name).toBe("ghl_sync_finish");
  expect(fake.calls[1].args.p_result).toMatchObject({ ok: false, failures: 1 });
});
it("missing configured commission is not replaced by 40 percent", async () => {
  fake.artists = [{ id: "a", ghl_calendar_id: "cal-a", active: true, commission_pct: null }];
  const result = await syncGhlAppointments();
  expect(result.ok).toBe(false); expect(result.failures).toBe(1);
  expect(fake.calls.some(c => c.name === "ghl_sync_write")).toBe(false);
});
it("zero events is successful only after a real calendar read and finish", async () => {
  fake.artists = [{ id: "a", ghl_calendar_id: "cal-a", active: true, commission_pct: 37 }];
  expect((await syncGhlAppointments()).ok).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fake.calls[1].args.p_result).toMatchObject({ ok: true, scannedCalendars: 1 });
});
it("failed completion persistence cannot be reported as success", async () => {
  fake.finishError = true;
  await expect(syncGhlAppointments()).rejects.toThrow("registrar conclusão");
});