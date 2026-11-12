import { describe, expect, it } from "vitest";
import { getAccountMenu } from "@/lib/account-menu";
import type { MyProfile } from "@/lib/auth.functions";
const profile = (patch: Partial<MyProfile>): MyProfile => ({
  userId: "example-user",
  email: "example@example.test",
  role: null,
  artistId: null,
  sellerId: null,
  ...patch,
});
const paths = (p: MyProfile | null) =>
  getAccountMenu(p).flatMap((section) => section.items.map((item) => item.to));

describe("account menu follows destination capabilities", () => {
  it("keeps reception, management and reconciliation in the admin menu", () => {
    const destinations = paths(profile({ role: "admin" }));
    expect(destinations).toEqual(
      expect.arrayContaining([
        "/admin/fila",
        "/totem",
        "/admin/equipe",
        "/reconciliar",
        "/admin/movimentacao/novo",
        "/admin/movimentacao-links",
      ]),
    );
    expect(destinations).not.toContain("/movimentacao/gabriel");
    expect(destinations).not.toContain("/movimentacao");
  });
  it("shows an artist's destinations without reception or management shortcuts", () => {
    expect(paths(profile({ role: "artist", artistId: "artist-a" }))).toEqual([
      "/projetos",
      "/financeiro",
      "/relatorios/movimentacoes",
      "/connect",
    ]);
  });
  it("does not offer projects, check-in or MCP setup to a seller", () => {
    expect(paths(profile({ role: "seller", sellerId: "seller-a" }))).toEqual([
      "/financeiro",
      "/relatorios/movimentacoes",
    ]);
  });
  it.each([
    null,
    profile({ role: null }),
    profile({ role: "unknown" as MyProfile["role"] }),
    profile({ role: "artist" }),
    profile({ role: "seller" }),
    profile({ role: "artist", sellerId: "seller-a" }),
    profile({ role: "seller", artistId: "artist-a" }),
  ])(
    "offers no operational actions without an identified role and matching association: %j",
    (p) => {
      expect(paths(p)).toEqual([]);
    },
  );
});
