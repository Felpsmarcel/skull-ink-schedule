import { describe, expect, it } from "vitest";
import {
  buildFinanceWorkspace,
  moneyCents,
  validateFinanceSource,
} from "@/lib/finance-workspace-core";
import type {
  FinanceProject,
  FinanceReceipt,
  FinanceSession,
  FinanceWorkspaceData,
  WorkspaceFilters,
} from "@/lib/finance-workspace-types";

const now = new Date("2026-11-12T12:00:00Z");
const filters: WorkspaceFilters = {
  area: "projects",
  period: "month",
  from: "",
  to: "",
  artist: "all",
};
const project = (overrides: Partial<FinanceProject> = {}): FinanceProject => ({
  id: "p1",
  title: "Projeto",
  client: "Cliente",
  artistId: "a1",
  artist: "Artista",
  date: "2026-11-12T12:00:00Z",
  status: "open",
  quotedCents: 100000,
  opportunityId: "o1",
  ...overrides,
});
const receipt = (overrides: Partial<FinanceReceipt> = {}): FinanceReceipt => ({
  id: "r1",
  client: "Cliente",
  artistId: "a1",
  artist: "Artista",
  date: "2026-11-12",
  kind: "sinal",
  amountCents: 15000,
  projectId: "p1",
  appointmentId: "ap1",
  methods: ["dinheiro"],
  sync: "synced",
  ...overrides,
});
const session = (overrides: Partial<FinanceSession> = {}): FinanceSession => ({
  id: "s1",
  client: "Cliente",
  artistId: "a1",
  artist: "Artista",
  date: "2026-11-12T12:00:00Z",
  status: "confirmed",
  projectId: "p1",
  amountCents: 100000,
  commissionCents: 35000,
  commissionPct: 35,
  excluded: false,
  ...overrides,
});
function data(overrides: Partial<FinanceWorkspaceData> = {}): FinanceWorkspaceData {
  return {
    role: "admin",
    updatedAt: now.toISOString(),
    artists: [{ id: "a1", name: "Artista" }],
    projects: { state: "complete", rows: [project()] },
    receipts: { state: "complete", rows: [receipt()] },
    sessions: { state: "complete", rows: [session()] },
    ...overrides,
  };
}
const metric = (model: ReturnType<typeof buildFinanceWorkspace>, label: string) =>
  model.metrics.find((item) => item.label === label)?.value;

describe("strict financial source values", () => {
  it.each([
    null,
    undefined,
    "",
    "  ",
    false,
    {},
    NaN,
    Infinity,
    -1,
    "-1",
    "1e3",
    "1,50",
    "EUR 20",
    "12.345",
    12.345,
    1.0000000001,
    "2020x",
    "90071992547409.92",
  ])("rejects unknown or invalid money %j", (input) => {
    expect(moneyCents(input)).toBeNull();
  });
  it("converts canonical decimals exactly without floating rounding or coercing blanks", () => {
    expect(moneyCents(0)).toBe(0);
    expect(moneyCents("0.00")).toBe(0);
    expect(moneyCents(" 150.50 ")).toBe(15050);
    expect(moneyCents(0.29)).toBe(29);
    expect(moneyCents("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER);
  });
  it("preserves distinct IDs even when labels match, but rejects duplicates or missing IDs", () => {
    const rows = [
      { id: "a", name: "Mesmo nome" },
      { id: "b", name: "Mesmo nome" },
    ];
    expect(validateFinanceSource(rows)).toBe(rows);
    expect(() => validateFinanceSource([{ id: "a" }, { id: "a" }])).toThrow();
    expect(() => validateFinanceSource([{ id: "" }])).toThrow();
    expect(() => validateFinanceSource([{ id: "  " }])).toThrow();
    expect(() => validateFinanceSource([{ id: " a" }])).toThrow();
    expect(() => validateFinanceSource([null] as unknown as { id: string }[])).toThrow();
  });
});

describe("shared artist and civil-date scopes", () => {
  it("filters project cards and rows together by immutable artist and project registration date", () => {
    const result = buildFinanceWorkspace(
      data({
        projects: {
          state: "complete",
          rows: [
            project(),
            project({ id: "p2", artistId: "a2", quotedCents: 900000 }),
            project({ id: "p3", date: "2026-10-12", quotedCents: 500000 }),
            project({ id: "p4", opportunityId: null, quotedCents: 20000 }),
          ],
        },
      }),
      { ...filters, artist: "a1" },
      now,
    );
    expect(result.projects.map((row) => row.id)).toEqual(["p1", "p4"]);
    expect(metric(result, "Orçamentos cadastrados")).toBe(120000);
    expect(metric(result, "Projetos cadastrados")).toBe(2);
    expect(metric(result, "Sem oportunidade vinculada")).toBe(1);
    expect(metric(result, "Vendas Won")).toBeNull();
    expect(result.receipts).toEqual([]);
    expect(result.sessions).toEqual([]);
  });
  it.each([
    ["2026-03-29", "2026-03-28T23:00:00Z", "2026-03-29T21:59:59Z", "2026-03-29T22:00:00Z"],
    ["2026-10-25", "2026-10-24T22:00:00Z", "2026-10-25T22:59:59Z", "2026-10-25T23:00:00Z"],
  ])("uses a half-open Brussels custom window on DST day %s", (day, first, last, next) => {
    const result = buildFinanceWorkspace(
      data({
        projects: {
          state: "complete",
          rows: [
            project({ id: "first", date: first }),
            project({ id: "last", date: last }),
            project({ id: "next", date: next }),
            project({ id: "civil", date: day }),
          ],
        },
      }),
      { ...filters, period: "custom", from: day, to: day },
      now,
    );
    expect(result.invalidPeriod).toBe(false);
    expect(result.projects.map((row) => row.id)).toEqual(["last", "civil", "first"]);
    expect(metric(result, "Orçamentos cadastrados")).toBe(300000);
  });
  it.each([
    ["today", "2026-11-12T00:05:00Z", "2026-11-11T23:00:00Z", "2026-11-12T23:00:00Z"],
    ["week", "2026-10-25T12:00:00Z", "2026-10-18T22:00:00Z", "2026-10-25T23:00:00Z"],
    ["month", "2026-10-31T23:30:00Z", "2026-10-31T23:00:00Z", "2026-11-30T23:00:00Z"],
  ] as const)("uses the existing Brussels %s interval", (period, time, first, next) => {
    const result = buildFinanceWorkspace(
      data({
        projects: {
          state: "complete",
          rows: [project({ id: "first", date: first }), project({ id: "next", date: next })],
        },
      }),
      { ...filters, period },
      new Date(time),
    );
    expect(result.projects.map((row) => row.id)).toEqual(["first"]);
  });
  it.each([
    ["2026-02-30", "2026-03-01"],
    ["2026-11-31", "2026-12-01"],
    ["2026-11-12", "2026-11-11"],
    ["", "2026-11-12"],
    ["2026-1-1", "2026-11-12"],
    ["2026-02-29", "2026-03-01"],
  ])("rejects invalid custom dates %s to %s", (from, to) => {
    const result = buildFinanceWorkspace(data(), { ...filters, period: "custom", from, to }, now);
    expect(result.invalidPeriod).toBe(true);
    expect(result.projects).toEqual([]);
    expect(result.metrics.every((item) => item.value === null)).toBe(true);
  });
  it("accepts a real leap day and ignores stale custom fields in all periods", () => {
    const input = data({
      projects: { state: "complete", rows: [project({ date: "2028-02-29" })] },
    });
    expect(
      buildFinanceWorkspace(
        input,
        { ...filters, period: "custom", from: "2028-02-29", to: "2028-02-29" },
        now,
      ).projects,
    ).toHaveLength(1);
    expect(
      buildFinanceWorkspace(input, { ...filters, period: "all", from: "bad", to: "bad" }, now)
        .projects,
    ).toHaveLength(1);
  });
});

describe("source completeness and financial meaning", () => {
  it("does not turn unavailable partial rows into a zero or sample total", () => {
    const result = buildFinanceWorkspace(
      data({ projects: { state: "unavailable", rows: [project()] } }),
      filters,
      now,
    );
    expect(result.sourceAvailable).toBe(false);
    expect(result.projects).toEqual([]);
    expect(result.metrics.every((item) => item.value === null)).toBe(true);
  });
  it.each(["invalid", "2026-02-30", "2026-11-12T25:00:00Z", "2026-11-12T12:00:00"])(
    "invalidates dates that cannot be safely scoped: %s",
    (date) => {
      const result = buildFinanceWorkspace(
        data({ projects: { state: "complete", rows: [project(), project({ id: "p2", date })] } }),
        filters,
        now,
      );
      expect(result.sourceAvailable).toBe(false);
      expect(result.projects).toEqual([]);
      expect(result.metrics.every((item) => item.value === null)).toBe(true);
    },
  );
  it("rejects duplicate sources instead of silently deduplicating", () => {
    const result = buildFinanceWorkspace(
      data({ receipts: { state: "complete", rows: [receipt(), receipt()] } }),
      { ...filters, area: "receipts" },
      now,
    );
    expect(result.sourceAvailable).toBe(false);
    expect(result.metrics.every((item) => item.value === null)).toBe(true);
  });
  it.each([null, 0, -1, 1.5, NaN, Infinity])(
    "unknown or invalid project budget %j never becomes a partial monetary aggregate",
    (quotedCents) => {
      const result = buildFinanceWorkspace(
        data({
          projects: { state: "complete", rows: [project(), project({ id: "p2", quotedCents })] },
        }),
        filters,
        now,
      );
      expect(metric(result, "Orçamentos cadastrados")).toBeNull();
      expect(metric(result, "Projetos cadastrados")).toBe(2);
      expect(result.projects).toHaveLength(2);
    },
  );
  it("shows a verified empty source as zero for knowable metrics, while Won remains unknown", () => {
    const result = buildFinanceWorkspace(
      data({ projects: { state: "complete", rows: [] } }),
      filters,
      now,
    );
    expect(metric(result, "Orçamentos cadastrados")).toBe(0);
    expect(metric(result, "Projetos cadastrados")).toBe(0);
    expect(metric(result, "Vendas Won")).toBeNull();
  });
  it("keeps deposit amounts separate from whole sessions and subtracts a refund once", () => {
    const result = buildFinanceWorkspace(
      data({
        receipts: {
          state: "complete",
          rows: [
            receipt(),
            receipt({ id: "r2", kind: "estorno", amountCents: 3000 }),
            receipt({ id: "r3", kind: "sessao", amountCents: 20000, projectId: null }),
          ],
        },
      }),
      { ...filters, area: "receipts" },
      now,
    );
    expect(metric(result, "Entradas registradas")).toBe(35000);
    expect(metric(result, "Estornos registrados")).toBe(-3000);
    expect(metric(result, "Líquido registrado")).toBe(32000);
    expect(metric(result, "Recebimentos comprovados")).toBeNull();
    expect(result.receipts[1].amountCents).toBe(3000);
    expect(result.metrics[0].note).toContain("1 lançamento(s) sem projeto");
  });
  it("allows a negative registered net without creating a sale or payout", () => {
    const result = buildFinanceWorkspace(
      data({
        receipts: { state: "complete", rows: [receipt({ kind: "estorno", amountCents: 90000 })] },
      }),
      { ...filters, area: "receipts" },
      now,
    );
    expect(metric(result, "Líquido registrado")).toBe(-90000);
    expect(metric(result, "Entradas registradas")).toBe(0);
    expect(metric(result, "Recebimentos comprovados")).toBeNull();
  });
  it.each([null, 0, -1, 12.5])(
    "invalidates all registered money aggregates for invalid receipt %j",
    (amountCents) => {
      const result = buildFinanceWorkspace(
        data({
          receipts: { state: "complete", rows: [receipt(), receipt({ id: "bad", amountCents })] },
        }),
        { ...filters, area: "receipts" },
        now,
      );
      expect(result.receipts).toHaveLength(2);
      expect(result.metrics.every((item) => item.value === null)).toBe(true);
    },
  );
  it("refuses to classify an unknown movement kind as income", () => {
    const result = buildFinanceWorkspace(
      data({ receipts: { state: "complete", rows: [receipt({ kind: "unknown" })] } }),
      { ...filters, area: "receipts" },
      now,
    );
    expect(metric(result, "Entradas registradas")).toBeNull();
    expect(metric(result, "Líquido registrado")).toBeNull();
  });
  it("filters receipts and sessions with the same artist/date criteria as their metrics", () => {
    const input = data({
      receipts: {
        state: "complete",
        rows: [
          receipt(),
          receipt({ id: "r2", artistId: "a2", amountCents: null }),
          receipt({ id: "r3", date: "2026-10-12" }),
        ],
      },
      sessions: {
        state: "complete",
        rows: [
          session(),
          session({ id: "s2", artistId: "a2", commissionCents: null }),
          session({ id: "s3", date: "2026-10-12" }),
        ],
      },
    });
    const receipts = buildFinanceWorkspace(
      input,
      { ...filters, area: "receipts", artist: "a1" },
      now,
    );
    const sessions = buildFinanceWorkspace(
      input,
      { ...filters, area: "sessions", artist: "a1" },
      now,
    );
    expect(receipts.receipts.map((row) => row.id)).toEqual(["r1"]);
    expect(metric(receipts, "Entradas registradas")).toBe(15000);
    expect(sessions.sessions.map((row) => row.id)).toEqual(["s1"]);
    expect(metric(sessions, "Comissão tatuadores estimada")).toBe(35000);
  });
  it("excludes cancellations, absences and Randevu from estimates but keeps their rows visible", () => {
    const result = buildFinanceWorkspace(
      data({
        sessions: {
          state: "complete",
          rows: [
            session(),
            session({
              id: "cancel",
              status: "cancelled",
              amountCents: null,
              commissionCents: null,
            }),
            session({ id: "absent", status: "no_show", amountCents: null, commissionCents: null }),
            session({ id: "randevu", excluded: true, amountCents: null, commissionCents: null }),
          ],
        },
      }),
      { ...filters, area: "sessions" },
      now,
    );
    expect(result.sessions).toHaveLength(4);
    expect(metric(result, "Base cadastrada")).toBe(100000);
    expect(metric(result, "Comissão tatuadores estimada")).toBe(35000);
    expect(result.metrics[0].note).toContain("1 sessão(ões) incluída(s)");
    expect(metric(result, "Comissão apurada")).toBeNull();
  });
  it("uses stored commission estimates rather than recalculating gross or applying a rate", () => {
    const result = buildFinanceWorkspace(
      data({
        sessions: {
          state: "complete",
          rows: [session({ amountCents: 100000, commissionCents: 20000, commissionPct: 35 })],
        },
      }),
      { ...filters, area: "sessions" },
      now,
    );
    expect(metric(result, "Comissão tatuadores estimada")).toBe(20000);
    expect(metric(result, "Comissão apurada")).toBeNull();
  });
  it("preserves unknown session estimates without inventing zero or gross-based commission", () => {
    const result = buildFinanceWorkspace(
      data({
        sessions: {
          state: "complete",
          rows: [session(), session({ id: "s2", amountCents: null, commissionCents: null })],
        },
      }),
      { ...filters, area: "sessions" },
      now,
    );
    expect(metric(result, "Base cadastrada")).toBeNull();
    expect(metric(result, "Comissão tatuadores estimada")).toBeNull();
    expect(result.metrics[0].note).toContain("2 sessão(ões) incluída(s)");
  });
  it("keeps seller estimates distinct from artists and uses zero only when no seller is assigned", () => {
    const result = buildFinanceWorkspace(
      data({
        sessions: {
          state: "complete",
          rows: [
            session({ sellerId: "seller-1", seller: "Vendedor", sellerCommissionCents: 5000 }),
            session({ id: "s2", sellerId: null, sellerCommissionCents: null }),
            session({ id: "s3" }),
            session({
              id: "excluded",
              excluded: true,
              sellerId: "seller-1",
              sellerCommissionCents: null,
            }),
          ],
        },
      }),
      { ...filters, area: "sessions" },
      now,
    );
    expect(result.metrics.map((item) => item.label)).toEqual([
      "Base cadastrada",
      "Comissão tatuadores estimada",
      "Comissão vendedores estimada",
      "Comissão apurada",
    ]);
    expect(metric(result, "Comissão vendedores estimada")).toBe(5000);
    expect(
      result.metrics.find((item) => item.label === "Comissão vendedores estimada")?.note,
    ).toContain("percentual atual do cadastro do vendedor");
    expect(metric(result, "Comissão tatuadores estimada")).toBe(105000);
    expect(result.sessions.find((row) => row.id === "s1")?.sellerId).toBe("seller-1");
    expect(
      metric(
        buildFinanceWorkspace(data(), { ...filters, area: "sessions" }, now),
        "Comissão vendedores estimada",
      ),
    ).toBe(0);
  });
  it.each([null, undefined, -10, 2.5, NaN])(
    "keeps assigned seller estimate %j unknown instead of using a partial sum",
    (sellerCommissionCents) => {
      const result = buildFinanceWorkspace(
        data({
          sessions: {
            state: "complete",
            rows: [
              session({ sellerId: "seller-1", sellerCommissionCents: 5000 }),
              session({ id: "s2", sellerId: "seller-2", sellerCommissionCents }),
            ],
          },
        }),
        { ...filters, area: "sessions" },
        now,
      );
      expect(metric(result, "Comissão vendedores estimada")).toBeNull();
      expect(metric(result, "Comissão tatuadores estimada")).toBe(70000);
    },
  );
  it.each(["projects", "receipts", "sessions"] as const)(
    "sorts %s newest first with deterministic IDs for equal dates without mutating sources",
    (area) => {
      const source = data({
        projects: {
          state: "complete",
          rows: [
            project({ id: "old", date: "2026-11-01" }),
            project({ id: "z", date: "2026-11-12T00:00:00+01:00" }),
            project({ id: "a", date: "2026-11-11T23:00:00Z" }),
          ],
        },
        receipts: {
          state: "complete",
          rows: [
            receipt({ id: "old", date: "2026-11-01" }),
            receipt({ id: "z" }),
            receipt({ id: "a" }),
          ],
        },
        sessions: {
          state: "complete",
          rows: [
            session({ id: "old", date: "2026-11-01" }),
            session({ id: "z" }),
            session({ id: "a" }),
          ],
        },
      });
      const result = buildFinanceWorkspace(source, { ...filters, area }, now);
      expect(result[area].map((row) => row.id)).toEqual(["a", "z", "old"]);
      expect(source[area].rows.map((row) => row.id)).toEqual(["old", "z", "a"]);
    },
  );
});

describe("role separation and payouts", () => {
  it.each(["artist", "seller"] as const)(
    "forces %s to scoped session presentation and ignores the artist selector",
    (role) => {
      const source = data({
        role,
        sessions: {
          state: "complete",
          rows: [
            session({
              sellerId: "seller-private",
              seller: "Vendedor privado",
              sellerCommissionCents: 5000,
            }),
          ],
        },
      });
      const result = buildFinanceWorkspace(
        source,
        { ...filters, area: "receipts", artist: "someone-else" },
        now,
      );
      expect(result.area).toBe("sessions");
      expect(result.projects).toEqual([]);
      expect(result.receipts).toEqual([]);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0]).not.toHaveProperty("amountCents");
      expect(result.sessions[0]).not.toHaveProperty("sellerId");
      expect(result.sessions[0]).not.toHaveProperty("seller");
      expect(result.sessions[0]).not.toHaveProperty("sellerCommissionCents");
      expect(Object.keys(result.sessions[0]).sort()).toEqual(
        [
          "id",
          "client",
          "artistId",
          "artist",
          "date",
          "status",
          "projectId",
          "commissionCents",
          "commissionPct",
          "excluded",
        ].sort(),
      );
      expect(result.metrics.some((item) => item.label === "Base cadastrada")).toBe(false);
      expect(metric(result, "Comissão estimada")).toBe(35000);
      expect(
        result.metrics
          .find((item) => item.label === "Comissão estimada")
          ?.note.includes("percentual atual do cadastro do vendedor"),
      ).toBe(role === "seller");
      expect(source.sessions.rows[0].amountCents).toBe(100000);
    },
  );
  it.each(["admin", "artist", "seller"] as const)(
    "does not derive %s payouts from studio receipts or session estimates",
    (role) => {
      const result = buildFinanceWorkspace(data({ role }), { ...filters, area: "payouts" }, now);
      expect(result.area).toBe("payouts");
      expect(result.sourceAvailable).toBe(false);
      expect(result.metrics.map((item) => [item.label, item.value])).toEqual([
        ["Apurado", null],
        ["Aprovado", null],
        ["Pago", null],
      ]);
      expect(result.projects).toEqual([]);
      expect(result.receipts).toEqual([]);
      expect(result.sessions).toEqual([]);
    },
  );
});
