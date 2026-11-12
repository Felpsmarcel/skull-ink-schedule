import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProjectPhotosAvailability } from "@/lib/project-photos.functions";

const fake = vi.hoisted(() => ({
  middleware: {},
  identity: { role: "artist", artist_id: "artist-a" } as {
    role: string;
    artist_id: string | null;
  } | null,
  projectArtist: "artist-a",
  failed: "",
  queries: [] as string[],
  filters: [] as [string, string, unknown][],
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
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => {
      filters[key] = value;
      fake.filters.push([table, key, value]);
      return query;
    },
    maybeSingle: async () =>
      fake.failed === table
        ? { data: null, error: { message: "synthetic failure" } }
        : {
            data:
              table === "app_users"
                ? fake.identity
                : filters.artist_id && filters.artist_id !== fake.projectArtist
                  ? null
                  : { id: "project-a" },
            error: null,
          },
  };
  return query;
}
const run = () =>
  (
    getProjectPhotosAvailability as unknown as {
      run: (context: unknown, data: unknown) => Promise<unknown>;
    }
  ).run({ userId: "verified-user", supabase: { from } }, { projectId: "project-a" });
beforeEach(() => {
  fake.identity = { role: "artist", artist_id: "artist-a" };
  fake.projectArtist = "artist-a";
  fake.failed = "";
  fake.queries = [];
  fake.filters = [];
});

describe("photo availability gate", () => {
  it("scopes artist access by verified artist ID and project ID before returning disabled", async () => {
    expect(await run()).toMatchObject({ kind: "disabled" });
    expect(fake.filters).toContainEqual(["app_users", "id", "verified-user"]);
    expect(fake.filters).toContainEqual(["tattoo_projects", "id", "project-a"]);
    expect(fake.filters).toContainEqual(["tattoo_projects", "artist_id", "artist-a"]);
    expect(fake.queries).toEqual(["app_users", "tattoo_projects"]);
  });
  it("does not expose even capabilities for another artist's project", async () => {
    fake.projectArtist = "artist-b";
    expect(await run()).toEqual({ kind: "forbidden" });
  });
  it.each([null, { role: "seller", artist_id: "artist-a" }, { role: "artist", artist_id: null }])(
    "rejects unauthorized identity before project reads",
    async (identity) => {
      fake.identity = identity;
      expect(await run()).toEqual({ kind: "forbidden" });
      expect(fake.queries).toEqual(["app_users"]);
    },
  );
  it("admin can inspect availability but storage remains disabled", async () => {
    fake.identity = { role: "admin", artist_id: null };
    expect(await run()).toMatchObject({ kind: "disabled" });
    expect(
      fake.filters.some(([table, key]) => table === "tattoo_projects" && key === "artist_id"),
    ).toBe(false);
  });
  it("fails closed on identity read error", async () => {
    fake.failed = "app_users";
    expect(await run()).toEqual({ kind: "forbidden" });
    expect(fake.queries).toEqual(["app_users"]);
  });
});
