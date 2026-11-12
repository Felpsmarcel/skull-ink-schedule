import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MyProfile } from "@/lib/auth.functions";
import type { MySlugResult } from "@/lib/my-movimentacao-link";
import { Route } from "@/routes/_authenticated/movimentacao.index";

const fake = vi.hoisted(() => ({
  profile: {
    data: undefined as MyProfile | undefined,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  slug: {
    data: undefined as MySlugResult | undefined,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  navigate: vi.fn(),
  query: undefined as { queryKey: unknown[]; enabled: boolean } | undefined,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => void) => effect(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => fake.navigate,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: typeof fake.query) => {
    fake.query = options;
    return fake.slug;
  },
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn() }));
vi.mock("@/lib/movimentacao.functions", () => ({ getMySlug: vi.fn() }));
vi.mock("@/hooks/use-current-user", () => ({ useCurrentUser: () => fake.profile }));

function render() {
  (Route.options.component as () => unknown)();
}
beforeEach(() => {
  fake.navigate.mockClear();
  fake.profile.data = {
    userId: "user-a",
    email: "fixture@example.com",
    role: "admin",
    artistId: null,
    sellerId: null,
  };
  fake.profile.isPending = false;
  fake.profile.isError = false;
  fake.slug.data = undefined;
  fake.slug.isPending = false;
  fake.slug.isError = false;
  fake.query = undefined;
});

describe("receipt-registration entry routing", () => {
  it("sends a confirmed admin directly to manual entry, without selecting or requesting a personal recipient", () => {
    fake.slug.data = { slug: "gabriel", displayName: "stale legacy fallback" };
    render();
    expect(fake.query?.enabled).toBe(false);
    expect(fake.navigate).toHaveBeenCalledExactlyOnceWith({
      to: "/admin/movimentacao/novo",
      replace: true,
    });
  });
  it.each(["artist", "seller"] as const)(
    "routes %s through its confirmed personal slug",
    (role) => {
      fake.profile.data = {
        ...fake.profile.data!,
        role,
        artistId: role === "artist" ? "artist-a" : null,
        sellerId: role === "seller" ? "seller-a" : null,
      };
      const slug = role === "artist" ? "andre" : "nivia";
      fake.slug.data = { slug, displayName: "Matched identity" };
      render();
      expect(fake.query?.enabled).toBe(true);
      expect(fake.query?.queryKey).toEqual([
        "my-movimentacao-slug",
        "user-a",
        role,
        fake.profile.data.artistId,
        fake.profile.data.sellerId,
      ]);
      expect(fake.navigate).toHaveBeenCalledExactlyOnceWith({
        to: "/movimentacao/$slug",
        params: { slug },
        replace: true,
      });
    },
  );
  it.each(["isPending", "isError"] as const)(
    "does not use a cached admin role while profile %s",
    (state) => {
      fake.profile[state] = true;
      render();
      expect(fake.query?.enabled).toBe(false);
      expect(fake.navigate).not.toHaveBeenCalled();
    },
  );
  it.each(["isPending", "isError"] as const)(
    "does not use a cached personal slug while link query %s",
    (state) => {
      fake.profile.data!.role = "artist";
      fake.slug.data = { slug: "andre", displayName: "Matched identity" };
      fake.slug[state] = true;
      render();
      expect(fake.navigate).not.toHaveBeenCalled();
    },
  );
  it("does not navigate an unknown role even if a slug remains cached", () => {
    fake.profile.data!.role = null;
    fake.slug.data = { slug: "andre", displayName: "Matched identity" };
    render();
    expect(fake.query?.enabled).toBe(false);
    expect(fake.navigate).not.toHaveBeenCalled();
  });
  it("leaves an unlinked artist at the missing-link explanation", () => {
    fake.profile.data!.role = "artist";
    fake.slug.data = { slug: null, reason: "no_link" };
    render();
    expect(fake.navigate).not.toHaveBeenCalled();
  });
  it("changes its cache key when another authenticated user arrives", () => {
    fake.profile.data!.role = "artist";
    render();
    const firstKey = fake.query?.queryKey;
    fake.profile.data!.userId = "user-b";
    render();
    expect(fake.query?.queryKey).not.toEqual(firstKey);
    expect(fake.query?.queryKey[1]).toBe("user-b");
  });
});
