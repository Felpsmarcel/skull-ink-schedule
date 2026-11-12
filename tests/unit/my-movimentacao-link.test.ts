import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOVIMENTACAO_PROD_ORIGIN, MOVIMENTACAO_SLUGS } from "@/config/movimentacao-slugs";
import { getMySlug } from "@/lib/movimentacao.functions";
import {
  getMovimentacaoLinkAddress,
  type MySlugIdentity,
  type MySlugResult,
} from "@/lib/my-movimentacao-link";

const fake = vi.hoisted(() => ({
  middleware: {},
  identity: null as MySlugIdentity | null,
  error: false,
  reads: [] as string[],
  filters: [] as [string, unknown][],
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: fake.middleware,
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: vi.fn() }));
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
        run: (context: unknown) => {
          expect(middleware).toEqual([fake.middleware]);
          return handler({ context });
        },
      }),
    };
    return builder;
  },
}));

function from(table: string) {
  fake.reads.push(table);
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => {
      fake.filters.push([key, value]);
      return query;
    },
    maybeSingle: async () => ({
      data: fake.identity,
      error: fake.error ? { message: "read failed" } : null,
    }),
  };
  return query;
}
const run = () =>
  (getMySlug as unknown as { run: (context: unknown) => Promise<MySlugResult> }).run({
    userId: "authenticated-user",
    supabase: { from },
  });
const andre = MOVIMENTACAO_SLUGS.andre;
const nivia = MOVIMENTACAO_SLUGS.nivia;
if (andre.kind !== "artist" || nivia.kind !== "seller")
  throw new Error("Test identity configuration changed");
const artistId = andre.artistId;
const sellerId = nivia.sellerId;

beforeEach(() => {
  fake.identity = null;
  fake.error = false;
  fake.reads = [];
  fake.filters = [];
});

describe("personal receipt-registration link", () => {
  it.each(["admin", "artist", "seller"])(
    "never assigns Gabriel to an unlinked %s",
    async (role) => {
      fake.identity = { role, artist_id: null, seller_id: null };
      expect(await run()).toEqual({ slug: null, reason: "no_link" });
      expect(fake.reads).toEqual(["app_users"]);
      expect(fake.filters).toEqual([["id", "authenticated-user"]]);
    },
  );
  it.each(["artist", "admin"])("keeps the explicitly linked artist for %s", async (role) => {
    fake.identity = { role, artist_id: artistId, seller_id: null };
    expect(await run()).toEqual({ slug: "andre", displayName: andre.displayName });
  });
  it.each(["seller", "admin"])("keeps the explicitly linked seller for %s", async (role) => {
    fake.identity = { role, artist_id: null, seller_id: sellerId };
    expect(await run()).toEqual({ slug: "nivia", displayName: nivia.displayName });
  });
  it.each([
    null,
    { role: null, artist_id: artistId, seller_id: null },
    { role: "unknown", artist_id: artistId, seller_id: sellerId },
    { role: "artist", artist_id: "not-mapped", seller_id: sellerId },
    { role: "seller", artist_id: artistId, seller_id: "not-mapped" },
    { role: "admin", artist_id: artistId, seller_id: sellerId },
  ])("fails closed on absent, unknown, mismatched or ambiguous identity %j", async (identity) => {
    fake.identity = identity;
    expect(await run()).toEqual({ slug: null, reason: "no_link" });
  });
  it("does not conceal a failed identity query as a missing link", async () => {
    fake.error = true;
    await expect(run()).rejects.toThrow("read failed");
  });
});

describe("receipt link destination", () => {
  it("uses the canonical production origin when actually on production", () => {
    expect(getMovimentacaoLinkAddress("andre", MOVIMENTACAO_PROD_ORIGIN)).toEqual({
      url: `${MOVIMENTACAO_PROD_ORIGIN}/movimentacao/andre`,
      isTest: false,
    });
  });
  it("recognizes the existing www production alias and preserves its origin", () => {
    expect(getMovimentacaoLinkAddress("andre", "https://www.gftattoocalendar.com")).toEqual({
      url: "https://www.gftattoocalendar.com/movimentacao/andre",
      isTest: false,
    });
  });
  it.each([
    "https://id-preview--project.lovable.app",
    "http://localhost:8784",
    "http://127.0.0.1:8784",
    "http://[::1]:8784",
    "https://staging.example.com",
    "https://www.gftattoocalendar.com.example.com",
    "http://www.gftattoocalendar.com",
  ])("keeps %s in its own origin and labels it as a test link", (origin) => {
    expect(getMovimentacaoLinkAddress("andre", origin)).toEqual({
      url: `${origin}/movimentacao/andre`,
      isTest: true,
    });
  });
  it.each([null, "", "invalid", "javascript:alert(1)", "file:///tmp/fixture.html"])(
    "never offers a production link before a valid browser origin is known (%s)",
    (origin) => {
      expect(getMovimentacaoLinkAddress("andre", origin)).toBeNull();
    },
  );
});
