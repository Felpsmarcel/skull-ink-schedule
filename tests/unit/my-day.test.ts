import { describe, expect, it } from "vitest";
import { canReadMyDay, correlateMyDay, myDayBounds, type DayAppointment, type DayCheckin } from "../../src/lib/my-day-core";
const a: DayAppointment = { id: "a", ghlId: "ga", name: "Synthetic", artist: "A", start: "2026-11-11T09:00:00Z", status: "confirmed" };
const c: DayCheckin = { id: "c", appointmentId: "a", ghlId: "ga", name: "Synthetic", status: "aguardando", arrived: "2026-11-11T08:50:00Z", started: null, finished: null };
describe("My Day read-only rules", () => {
  it("confirmed without check-in is unverified, not arrived or absent", () => {
    expect(correlateMyDay([a], []).rows[0]?.state).toBe("unverified");
  });
  it("showed alone does not prove completion", () => {
    expect(correlateMyDay([{ ...a, status: "showed" }], []).rows[0]?.state).toBe("unverified");
  });
  it("arrival links by immutable appointment ID", () => {
    expect(correlateMyDay([a], [c]).rows[0]?.state).toBe("waiting");
  });
  it("contradictory IDs never select another session", () => {
    const result = correlateMyDay([a, { ...a, id: "b", ghlId: "gb" }], [{ ...c, ghlId: "gb" }]);
    expect(result.rows.map(r => r.state)).toEqual(["conflict", "conflict"]);
    expect(result.unresolved).toHaveLength(1);
  });
  it("homonyms with different IDs are not correlated", () => {
    expect(correlateMyDay([a], [{ ...c, appointmentId: null, ghlId: null }]).unresolved).toHaveLength(1);
  });
  it("multiple check-ins do not silently choose one", () => {
    expect(correlateMyDay([a], [c, { ...c, id: "c2" }]).rows[0]?.state).toBe("conflict");
  });
  it("supports proven CRM IDs when local link is absent", () => {
    expect(correlateMyDay([a], [{ ...c, appointmentId: null }]).rows[0]?.checkin?.id).toBe("c");
  });
  it("admin-only rollout rejects artists, sellers and unknown profiles", () => {
    expect(canReadMyDay("admin")).toBe(true);
    for (const role of ["artist", "seller", "recepcao", null, undefined, "unknown"]) expect(canReadMyDay(role)).toBe(false);
  });
  it("winter uses Brussels UTC+1", () => {
    expect(myDayBounds(new Date("2026-11-11T12:00:00Z"))).toEqual({ day: "2026-11-11", start: "2026-11-10T23:00:00.000Z", end: "2026-11-11T23:00:00.000Z" });
  });
  it("spring DST civil day is 23 hours", () => {
    const bounds = myDayBounds(new Date("2026-03-29T12:00:00Z"));
    expect(Date.parse(bounds.end) - Date.parse(bounds.start)).toBe(23 * 3600_000);
  });
  it("fall DST civil day is 25 hours", () => {
    const bounds = myDayBounds(new Date("2026-10-25T12:00:00Z"));
    expect(Date.parse(bounds.end) - Date.parse(bounds.start)).toBe(25 * 3600_000);
  });
});