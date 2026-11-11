import { describe, expect, it } from "vitest";
import { sessionStartForDay } from "../../src/lib/appointment-session-date";

describe("appointment date selection", () => {
  it("clears December 1 at 14:00 when December 5 is selected", () => {
    expect(
      sessionStartForDay("2026-12-01T13:00:00.000Z", new Date("2026-12-05T12:00:00Z")),
    ).toBeNull();
  });
  it("keeps the time when the same Brussels date is selected again", () => {
    expect(sessionStartForDay("2026-12-01T13:00:00.000Z", new Date("2026-11-30T23:00:00Z"))).toBe(
      "2026-12-01T13:00:00.000Z",
    );
  });
  it("clears only the edited session, preserving the other project dates", () => {
    const starts = ["2026-12-01T13:00:00Z", "2026-12-06T13:00:00Z", "2026-12-20T13:00:00Z"];
    const updated = starts.map((start, i) =>
      i === 1 ? sessionStartForDay(start, new Date("2026-12-05T12:00:00Z")) : start,
    );
    expect(updated).toEqual(["2026-12-01T13:00:00Z", null, "2026-12-20T13:00:00Z"]);
  });
});
