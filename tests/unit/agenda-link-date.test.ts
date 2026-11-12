import { describe, expect, it } from "vitest";
import { agendaLinkDay, parseAgendaLinkDate } from "@/lib/agenda-link-date";

describe("agenda navigation dates", () => {
  it("rejects malformed or normalized invalid civil dates", () => {
    for (const value of [
      undefined,
      {},
      "2026-02-30",
      "2026-11-31",
      "2026-13-01",
      "2026-1-2",
      "2026-11-12T09:00:00Z",
    ])
      expect(parseAgendaLinkDate(value)).toBeUndefined();
  });
  it("round trips future and DST transition dates in Brussels", () => {
    for (const day of ["2026-12-15", "2026-03-29", "2026-10-25", "2028-02-29"])
      expect(agendaLinkDay(parseAgendaLinkDate(day)!.toISOString())).toBe(day);
  });
  it("links late UTC appointments to the correct Brussels day", () => {
    expect(agendaLinkDay("2026-11-12T23:30:00Z")).toBe("2026-11-13");
    expect(agendaLinkDay("invalid")).toBeUndefined();
  });
});
