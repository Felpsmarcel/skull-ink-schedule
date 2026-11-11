import { describe, expect, it } from "vitest";
import {
  commercialPresentation,
  panelBounds,
  projectContinuity,
  requirePanelAdmin,
  type PanelAppointment,
} from "../../src/lib/artist-panel-core";

describe("panel authorization: admin preview until RLS homologation", () => {
  it("accepts verified administrator", () =>
    expect(() => requirePanelAdmin({ role: "admin" })).not.toThrow());
  for (const identity of [
    { role: "artist", artist_id: "andre" },
    { role: "artist", artist_id: "other" },
    { role: "artist" },
    { role: "seller" },
    { role: "unknown" },
    null,
  ]) {
    it(`rejects ${JSON.stringify(identity)} without payload`, () => {
      try {
        requirePanelAdmin(identity);
        throw new Error("should reject");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(403);
      }
    });
  }
});

const appointment = (
  id: string,
  projectId: string | null,
  startAt: string,
  status = "confirmed",
): PanelAppointment => ({
  id,
  projectId,
  startAt,
  endAt: startAt,
  status,
  name: "Synthetic",
  ghlId: null,
});
describe("continuity without inferred tattoo classification", () => {
  it("counts 3 linked appointments, not unlinked consultation or another project", () => {
    const rows = [
      appointment("consultation", null, "2026-11-01T10:30:00Z", "completed"),
      ...[5, 6, 20].map((d) =>
        appointment(String(d), "project-a", `2026-12-${String(d).padStart(2, "0")}T09:00:00Z`),
      ),
      appointment("other", "project-b", "2026-12-07T09:00:00Z"),
    ];
    expect(projectContinuity("project-a", rows, Date.parse("2026-11-11"))).toEqual({
      linked: 3,
      done: 0,
      future: 3,
      next: "2026-12-05T09:00:00Z",
    });
    expect(projectContinuity("project-b", rows, Date.parse("2026-11-11")).linked).toBe(1);
  });
  it("retains unknown on failed agenda read", () =>
    expect(projectContinuity("a", null, 0)).toEqual({
      linked: null,
      done: null,
      future: null,
      next: null,
    }));
  it("does not invent future date or completion", () =>
    expect(projectContinuity("a", [], 0)).toEqual({ linked: 0, done: 0, future: 0, next: null }));
  it("uses explicit completed status, not elapsed time", () =>
    expect(
      projectContinuity(
        "a",
        [
          appointment("1", "a", "2026-01-01", "confirmed"),
          appointment("2", "a", "2026-01-02", "completed"),
        ],
        Date.parse("2026-11-11"),
      ),
    ).toEqual({ linked: 2, done: 1, future: 0, next: null }));
});

describe("commercial versus cash presentation", () => {
  it("2700 project minus 450 informed deposit is 2250, cash remains 0/2700", () => {
    expect(commercialPresentation(2700, 450, [])).toEqual({
      quotedCents: 270000,
      depositCents: 45000,
      indicativeBalance: 225000,
      cash: 0,
      cashBalance: 270000,
      needsReconciliation: false,
      movementsCount: 0,
    });
  });
  it("never blindly subtracts signal and potentially overlapping cash", () => {
    const result = commercialPresentation(2700, 450, [{ total: 450, tipo: "sinal" }]);
    expect(result.indicativeBalance).toBeNull();
    expect(result.cashBalance).toBe(225000);
    expect(result.needsReconciliation).toBe(true);
  });
  it("cash failure is unavailable not zero", () => {
    const result = commercialPresentation(2700, 450, null);
    expect(result.cash).toBeNull();
    expect(result.indicativeBalance).toBeNull();
  });
  it("invalid cash invalidates total", () =>
    expect(commercialPresentation(2700, 450, [{ total: null, tipo: "sessao" }]).cash).toBeNull());
});

describe("Brussels civil dates and horizons", () => {
  it("spring transition is a 23h day", () => {
    const b = panelBounds(new Date("2026-03-29T12:00Z"), 30);
    expect(Date.parse(b.tomorrow) - Date.parse(b.start)).toBe(23 * 3600000);
    expect(b.end).toBe("2026-04-27T22:00:00.000Z");
  });
  it("autumn transition is a 25h day", () => {
    const b = panelBounds(new Date("2026-10-25T12:00Z"), 60);
    expect(Date.parse(b.tomorrow) - Date.parse(b.start)).toBe(25 * 3600000);
  });
  it("60 days includes the December 20 appointment on November 11", () => {
    const b = panelBounds(new Date("2026-11-11T03:19Z"), 60);
    expect("2026-12-20T09:00:00.000Z" < b.end).toBe(true);
  });
});
