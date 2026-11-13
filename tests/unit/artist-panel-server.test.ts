import { beforeEach, describe, expect, it, vi } from "vitest";
import { getArtistPanel, getProjectCommercialPresentation } from "@/lib/artist-panel.functions";
import { DEFAULT_PANEL_ARTIST_ID } from "@/lib/artist-panel-core";

const fake = vi.hoisted(() => ({
  middleware: {},
  role: "admin" as string | null,
  artistId: "andre" as string | null,
  queries: [] as string[],
  filters: [] as [string, string, unknown][],
  failed: "",
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: fake.middleware,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let middleware: unknown[] = [];
    const builder = {
      middleware: (items: unknown[]) => {
        middleware = items;
        return builder;
      },
      inputValidator: () => builder,
      handler: (handler: (args: unknown) => unknown) => ({
        run: (context: unknown, data: unknown) => {
          expect(middleware).toEqual([fake.middleware]);
          return handler({ context, data });
        },
      }),
    };
    return builder;
  },
}));

function from(table: string) {
  fake.queries.push(table);
  const filters: Record<string, unknown> = {};
  const result = () => {
    if (fake.failed === table)
      return { data: null, error: { message: "synthetic source failure" } };
    if (table === "app_users")
      return {
        data: fake.role ? { role: fake.role, artist_id: fake.artistId } : null,
        error: null,
      };
    if (table === "artists")
      return {
        data: [
          { id: DEFAULT_PANEL_ARTIST_ID, name: "Artista sintético" },
          { id: "other-id", name: "Outro sintético" },
        ],
        error: null,
      };
    if (table === "tattoo_projects")
      return {
        data: filters.id
          ? { quoted_total_eur: 2700, deposit_eur: 450 }
          : [{ id: "project-a", title: "Projeto sintético", status: "scheduled" }],
        error: null,
      };
    if (table === "appointments")
      return {
        data: [5, 6, 20].map((day) => ({
          id: String(day),
          project_id: "project-a",
          contact_name: "Cliente sintético",
          start_at: `2026-12-${String(day).padStart(2, "0")}T09:00:00Z`,
          end_at: `2026-12-${String(day).padStart(2, "0")}T18:00:00Z`,
          status: "confirmed",
          ghl_appointment_id: null,
        })),
        error: null,
      };
    return { data: [], error: null };
  };
  const q = {
    select: () => q,
    eq: (key: string, value: unknown) => {
      filters[key] = value;
      fake.filters.push([table, key, value]);
      return q;
    },
    in: () => q,
    is: () => q,
    order: () => q,
    range: () => q,
    maybeSingle: async () => result(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
  };
  return q;
}
const run = (fn: unknown, data: unknown) =>
  (fn as { run: (context: unknown, data: unknown) => Promise<unknown> }).run(
    { userId: "authenticated-id", supabase: { from } },
    data,
  );
beforeEach(() => {
  fake.role = "admin";
  fake.artistId = "andre";
  fake.queries = [];
  fake.filters = [];
  fake.failed = "";
});

describe("panel server authorization and projections", () => {
  it.each(["seller", "unknown", null])(
    "rejects %s before any private query, including forged selected artist",
    async (role) => {
      fake.role = role;
      await expect(
        run(getArtistPanel, { artistId: DEFAULT_PANEL_ARTIST_ID, horizon: 60 }),
      ).rejects.toMatchObject({ status: 403 });
      expect(fake.queries).toEqual(["app_users"]);
    },
  );
  it("artist with forged artistId never reads another artist's agenda", async () => {
    fake.role = "artist";
    fake.artistId = "own-artist";
    await run(getArtistPanel, { artistId: DEFAULT_PANEL_ARTIST_ID, horizon: 60 }).catch(() => null);
    expect(fake.filters.some((f) => (f as unknown[])[2] === DEFAULT_PANEL_ARTIST_ID)).toBe(false);
  });
  it("rejects artist without identity link", async () => {
    fake.role = "artist";
    fake.artistId = null;
    await expect(run(getArtistPanel, { horizon: 60 })).rejects.toMatchObject({ status: 403 });
    expect(fake.queries).toEqual(["app_users"]);
  });
  it("rejects invalid administrative artist before projects", async () => {
    await expect(run(getArtistPanel, { artistId: "invalid", horizon: 60 })).rejects.toMatchObject({
      status: 403,
    });
    expect(fake.queries).not.toContain("appointments");
  });
  it("scopes both appointments and projects to selected validated artist", async () => {
    const result = await run(getArtistPanel, { artistId: "other-id", horizon: 60 });
    expect(fake.filters).toContainEqual(["appointments", "artist_id", "other-id"]);
    expect(fake.filters).toContainEqual(["tattoo_projects", "artist_id", "other-id"]);
    expect(JSON.stringify(result)).not.toMatch(/quoted|deposit|commission|finance|phone|email/);
  });
  it("uses verified default Andre ID", async () => {
    await run(getArtistPanel, { horizon: 60 });
    expect(fake.filters).toContainEqual(["appointments", "artist_id", DEFAULT_PANEL_ARTIST_ID]);
  });
  it("agenda failure retains project with unknown counts", async () => {
    fake.failed = "appointments";
    const result = (await run(getArtistPanel, { horizon: 60 })) as {
      today: unknown;
      upcoming: unknown;
      projects: { continuity: { linked: unknown; future: unknown } }[];
    };
    expect(result.today).toBeNull();
    expect(result.upcoming).toBeNull();
    expect(result.projects[0]?.continuity.linked).toBeNull();
    expect(result.projects[0]?.continuity.future).toBeNull();
  });
  it("project failure preserves independent agenda", async () => {
    fake.failed = "tattoo_projects";
    const result = (await run(getArtistPanel, { horizon: 60 })) as {
      projects: unknown;
      today: unknown;
    };
    expect(result.projects).toBeNull();
    expect(result.today).not.toBeNull();
  });
});
describe("commercial presentation server admin only", () => {
  it("does not read projects or cash for artist", async () => {
    fake.role = "artist";
    await expect(
      run(getProjectCommercialPresentation, { projectId: "project-a" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(fake.queries).toEqual(["app_users"]);
  });
  it("cash failure remains null instead of fabricated zero", async () => {
    fake.failed = "movimentacoes";
    const result = (await run(getProjectCommercialPresentation, { projectId: "project-a" })) as {
      cash: unknown;
      indicativeBalance: unknown;
    };
    expect(result.cash).toBeNull();
    expect(result.indicativeBalance).toBeNull();
  });
});
