import { describe, expect, it, vi } from "vitest";
import { getFinanceWorkspace } from "@/lib/finance-workspace.functions";
import { RANDEVU_CALENDAR_ID } from "@/lib/artist-commission-policy";
import type { FinanceWorkspaceData } from "@/lib/finance-workspace-types";

const auth = vi.hoisted(() => ({ middleware: {} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: auth.middleware,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let middleware: unknown[] = [];
    const builder = {
      middleware: (value: unknown[]) => {
        middleware = value;
        return builder;
      },
      handler: (handler: (args: unknown) => unknown) => ({
        run: (context: unknown) => {
          expect(middleware).toEqual([auth.middleware]);
          return handler({ context });
        },
      }),
    };
    return builder;
  },
}));

type Fixture = {
  profile?: unknown;
  linked?: unknown;
  sources?: Record<string, Record<string, unknown>[]>;
  failed?: string;
  countDelta?: number;
};
function fixture({
  profile = { role: "admin" },
  linked,
  sources = {},
  failed,
  countDelta = 0,
}: Fixture = {}) {
  const calls: Array<{ source: string; select?: string; filters: unknown[]; ranges: number[][] }> =
    [];
  const query = (source: string) => {
    const call = {
      source,
      select: undefined as string | undefined,
      filters: [] as unknown[],
      ranges: [] as number[][],
    };
    calls.push(call);
    const q = {
      select: (value: string) => {
        call.select = value;
        return q;
      },
      eq: (key: string, value: unknown) => {
        call.filters.push([key, value]);
        return q;
      },
      is: (key: string, value: unknown) => {
        call.filters.push([key, value]);
        return q;
      },
      order: () => q,
      maybeSingle: async () => ({ data: source === "app_users" ? profile : linked, error: null }),
      range: async (from: number, to: number) => {
        call.ranges.push([from, to]);
        const rows = sources[source] ?? [];
        return {
          data: rows.slice(from, to + 1),
          error: failed === source ? "unavailable" : null,
          count: rows.length + countDelta,
        };
      },
    };
    return q;
  };
  const rpc = vi.fn(query);
  return {
    calls,
    rpc,
    run: () =>
      (
        getFinanceWorkspace as unknown as {
          run: (context: unknown) => Promise<FinanceWorkspaceData>;
        }
      ).run({
        userId: "verified-user",
        supabase: { from: query, rpc },
      }),
  };
}
const session = {
  id: "session-1",
  artist_id: "artist-1",
  seller_id: "seller-1",
  calendar_id: "tattoo-calendar",
  contact_name: "Cliente",
  start_at: "2026-11-12T10:00:00Z",
  status: "confirmed",
  project_id: "project-1",
  total_eur: 1000,
  commission_pct: 35,
  commission_eur: 350,
  artists: { name: "Artista" },
  sellers: { name: "Vendedor", commission_pct: 10 },
};
const project = {
  id: "project-1",
  title: "Cobertura",
  artist_id: "artist-1",
  created_at: "2026-10-01T12:00:00Z",
  status: "quoted",
  quoted_total_eur: 0,
  ghl_opportunity_id: "opportunity-1",
  contacts: { name: "Cliente" },
  artists: { name: "Artista" },
};
const receipt = {
  id: "receipt-1",
  nome_cliente: "Cliente",
  artist_id: "artist-1",
  data_pagamento: "2026-11-12",
  tipo_movimento: "sinal",
  total: 100,
  valor_cartao: 0,
  valor_dinheiro: 100,
  valor_sumup: 0,
  valor_transferencia: 0,
  project_id: "project-1",
  appointment_id: "session-1",
  ghl_sync_status: "synced",
  artists: { name: "Artista" },
};

describe("Finance workspace server boundaries", () => {
  it.each([
    null,
    { role: "unknown" },
    { role: "artist", artist_id: null },
    { role: "seller", seller_id: null },
  ])("rejects unresolved identity before any ledger read", async (profile) => {
    const app = fixture({ profile });
    await expect(app.run()).rejects.toMatchObject({ status: 403 });
    expect(app.calls.map((call) => call.source)).toEqual(["app_users"]);
    expect(app.rpc).not.toHaveBeenCalled();
  });
  it("rejects an inactive linked artist before the own-appointments RPC", async () => {
    const app = fixture({
      profile: { role: "artist", artist_id: "artist-1" },
      linked: { id: "artist-1", active: false },
    });
    await expect(app.run()).rejects.toMatchObject({ status: 403 });
    expect(app.rpc).not.toHaveBeenCalled();
  });
  it("only serializes the seller commission allowlist, even if its RPC includes gross fields", async () => {
    const app = fixture({
      profile: { role: "seller", seller_id: "seller-1" },
      linked: { id: "seller-1", name: "Vendedor", active: true },
      sources: { get_my_seller_appointments: [{ ...session, secret: "not-exported" }] },
    });
    const result = await app.run();
    expect(result.sessions.state).toBe("complete");
    expect(result.sessions.rows[0]).toMatchObject({
      commissionCents: 35000,
      commissionPct: 35,
      projectId: null,
    });
    for (const field of [
      "amountCents",
      "total_eur",
      "secret",
      "project_id",
      "sellerId",
      "seller",
      "sellerCommissionCents",
    ])
      expect(result.sessions.rows[0]).not.toHaveProperty(field);
    expect(result.projects).toEqual({ state: "unavailable", rows: [] });
    expect(result.receipts).toEqual({ state: "unavailable", rows: [] });
    expect(result.artists).toEqual([]);
    const rpc = app.calls.find((call) => call.source === "get_my_seller_appointments")!;
    expect(rpc.filters).toContainEqual(["seller_id", "seller-1"]);
    expect(rpc.select).not.toContain("total_eur");
    expect(
      app.calls.some((call) =>
        ["tattoo_projects", "payments", "movimentacoes", "appointments"].includes(call.source),
      ),
    ).toBe(false);
  });
  it("rejects a foreign ID returned by a scoped RPC rather than silently including it", async () => {
    const app = fixture({
      profile: { role: "artist", artist_id: "artist-1" },
      linked: { id: "artist-1", name: "Artista", active: true },
      sources: { get_my_artist_appointments: [{ ...session, artist_id: "foreign" }] },
    });
    expect((await app.run()).sessions).toEqual({ state: "unavailable", rows: [] });
  });
  it("keeps default quotes unknown, checks receipt method sums and uses the stored session rate", async () => {
    const app = fixture({
      sources: {
        tattoo_projects: [project],
        movimentacoes: [{ ...receipt, total: 120 }],
        appointments: [session],
      },
    });
    const result = await app.run();
    expect(result.projects.rows[0]).toMatchObject({ quotedCents: null, date: project.created_at });
    expect(result.receipts.rows[0]).toMatchObject({
      amountCents: null,
      date: receipt.data_pagamento,
    });
    expect(result.sessions.rows[0]).toMatchObject({
      amountCents: 100000,
      commissionCents: 35000,
      commissionPct: 35,
      sellerId: "seller-1",
      seller: "Vendedor",
      sellerCommissionCents: 10000,
    });
    expect(app.calls.some((call) => call.source === "payments")).toBe(false);
    expect(app.calls.find((call) => call.source === "movimentacoes")?.filters).toContainEqual([
      "deleted_at",
      null,
    ]);
  });
  it("distinguishes absent sellers from assigned sellers with an unknown current rate", async () => {
    const app = fixture({
      sources: {
        appointments: [
          { ...session, id: "unassigned", seller_id: null, sellers: null },
          { ...session, id: "unresolved", sellers: null },
          { ...session, id: "invalid-rate", sellers: { name: "Vendedor", commission_pct: -1 } },
        ],
      },
    });
    expect((await app.run()).sessions.rows.map((row) => row.sellerCommissionCents)).toEqual([
      0,
      null,
      null,
    ]);
  });
  it("preserves excluded cancelled, no-show and Randevu rows as excluded estimates", async () => {
    const app = fixture({
      sources: {
        appointments: [
          { ...session, id: "cancelled", status: "cancelled" },
          { ...session, id: "no-show", status: "no_show" },
          { ...session, id: "randevu", calendar_id: RANDEVU_CALENDAR_ID },
          { ...session, id: "tattoo" },
        ],
      },
    });
    expect((await app.run()).sessions.rows.map((row) => row.excluded)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });
  it("paginates the complete receipt ledger and never merges a payment source", async () => {
    const app = fixture({
      sources: {
        movimentacoes: Array.from({ length: 251 }, (_, index) => ({
          ...receipt,
          id: `receipt-${index}`,
        })),
      },
    });
    const result = await app.run();
    expect(result.receipts.state).toBe("complete");
    expect(result.receipts.rows).toHaveLength(251);
    expect(
      app.calls.filter((call) => call.source === "movimentacoes").flatMap((call) => call.ranges),
    ).toEqual([
      [0, 249],
      [250, 499],
    ]);
  });
  it("does not report complete data when the count contradicts a short page", async () => {
    const app = fixture({ sources: { movimentacoes: [receipt] }, countDelta: 1 });
    expect((await app.run()).receipts).toEqual({ state: "unavailable", rows: [] });
  });
  it.each([
    { sources: { movimentacoes: [receipt, receipt] } },
    { sources: { movimentacoes: [{ ...receipt, data_pagamento: "2026-02-31" }] } },
    { sources: { movimentacoes: [receipt] }, failed: "movimentacoes" },
  ])("keeps a failed receipt section isolated from valid sessions", async (input) => {
    const app = fixture({ ...input, sources: { ...input.sources, appointments: [session] } });
    const result = await app.run();
    expect(result.receipts).toEqual({ state: "unavailable", rows: [] });
    expect(result.sessions.state).toBe("complete");
    expect(result.sessions.rows).toHaveLength(1);
  });
});
