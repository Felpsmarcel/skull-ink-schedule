import { describe, it, expect } from "vitest";
import { financePeriodBounds, filterFinanceRows } from "@/lib/finance-list-filters";

describe("finance list civil periods", () => {
  it("includes the exact Brussels day and excludes tomorrow", () => {
    const rows = [
      "2026-11-11T22:59:59Z",
      "2026-11-11T23:00:00Z",
      "2026-11-12T22:59:59Z",
      "2026-11-12T23:00:00Z",
      "invalid",
    ].map((startAt, id) => ({ id, startAt, bucket: "pago" as const }));
    expect(
      filterFinanceRows(rows, "today", "all", "all", "all", new Date("2026-11-12T01:00:00Z")).map(
        (r) => r.id,
      ),
    ).toEqual([1, 2]);
  });
  it("handles the 23-hour and 25-hour Brussels DST days", () => {
    const spring = financePeriodBounds("today", new Date("2026-03-29T12:00:00Z"))!;
    const autumn = financePeriodBounds("today", new Date("2026-10-25T12:00:00Z"))!;
    expect((spring.to - spring.from) / 3600000).toBe(23);
    expect((autumn.to - autumn.from) / 3600000).toBe(25);
  });
  it("uses Brussels month even when UTC is still in the previous month", () => {
    const bounds = financePeriodBounds("month", new Date("2026-10-31T23:30:00Z"))!;
    expect(new Date(bounds.from).toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(new Date(bounds.to).toISOString()).toBe("2026-11-30T23:00:00.000Z");
  });
  it("uses Monday to Monday over the autumn clock change", () => {
    const bounds = financePeriodBounds("week", new Date("2026-10-25T13:00:00Z"))!;
    expect(new Date(bounds.from).toISOString()).toBe("2026-10-18T22:00:00.000Z");
    expect(new Date(bounds.to).toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });
  it("keeps immutable artist/seller filters and preserves row values", () => {
    const rows = [
      {
        id: "a",
        startAt: "2026-11-01T09:00:00Z",
        bucket: "pago" as const,
        artistId: "artist-a",
        sellerId: null,
        amount: 35,
      },
      {
        id: "b",
        startAt: "2026-11-02T09:00:00Z",
        bucket: "pago" as const,
        artistId: "artist-a",
        sellerId: "seller-a",
        amount: 40,
      },
      {
        id: "c",
        startAt: "2026-11-02T09:00:00Z",
        bucket: "pendente" as const,
        artistId: "artist-b",
        sellerId: null,
        amount: 100,
      },
    ];
    expect(filterFinanceRows(rows, "all", "pago", "artist-a", "none")).toEqual([rows[0]]);
    expect(filterFinanceRows(rows, "all", "all", "all", "seller-a")).toEqual([rows[1]]);
  });
});
