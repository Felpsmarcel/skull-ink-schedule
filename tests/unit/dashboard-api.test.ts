import { beforeEach, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  valid: true,
  profile: { role: "admin", artist_id: null } as any,
  read: vi.fn(),
}));
vi.mock("@/lib/mcp/supabase", () => ({
  supabaseForBearer: () => ({
    auth: {
      getUser: async () => ({
        data: { user: fake.valid ? { id: "verified-user" } : null },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: fake.profile, error: null }) }),
        order: () => ({
          eq: async () => ({ data: [], error: null }),
          then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/dashboard-read.server", () => ({ readDashboard: fake.read }));
import { mobileDashboardResponse } from "../../src/lib/dashboard-api.server";
const request = (query = "from=2026-10-25&to=2026-10-25", auth = "Bearer fictional") =>
  new Request("https://example.test/api/public/mobile-dashboard?" + query, {
    headers: auth ? { authorization: auth } : {},
  });
beforeEach(() => {
  fake.valid = true;
  fake.profile = { role: "admin", artist_id: null };
  fake.read.mockReset();
  fake.read.mockResolvedValue({ partial: false });
});
it("401 without bearer or with invalid token", async () => {
  expect((await mobileDashboardResponse(request("", ""))).status).toBe(401);
  fake.valid = false;
  expect((await mobileDashboardResponse(request())).status).toBe(401);
  expect(fake.read).not.toHaveBeenCalled();
});
it("403 for unknown role or unlinked artist", async () => {
  for (const p of [{ role: "unknown" }, { role: "artist", artist_id: null }]) {
    fake.profile = p;
    expect((await mobileDashboardResponse(request())).status).toBe(403);
  }
  expect(fake.read).not.toHaveBeenCalled();
});
it("rejects arbitrary artist/location/user identifiers", async () => {
  for (const k of ["artistId", "locationId", "userId"])
    expect(
      (await mobileDashboardResponse(request("from=2026-10-25&to=2026-10-25&" + k + "=foreign")))
        .status,
    ).toBe(400);
  expect(fake.read).not.toHaveBeenCalled();
});
it("verified admin can read and responses are never publicly cached", async () => {
  const r = await mobileDashboardResponse(request());
  expect(r.status).toBe(200);
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(fake.read.mock.calls[0]?.[1].role).toBe("admin");
});
