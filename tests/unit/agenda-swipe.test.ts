import { describe, expect, it } from "vitest";
import { agendaSwipeAxis, agendaSwipeDayDelta } from "../../src/lib/agenda-swipe";

describe("daily agenda gestures", () => {
  it("left advances exactly one day and right returns one day", () => {
    expect(agendaSwipeDayDelta(-100, 5, 300)).toBe(1);
    expect(agendaSwipeDayDelta(100, 5, 300)).toBe(-1);
  });
  it("vertical or diagonal scrolling does not change the date", () => {
    expect(agendaSwipeDayDelta(80, 100, 300)).toBe(0);
    expect(agendaSwipeDayDelta(80, 70, 300)).toBe(0);
    expect(agendaSwipeAxis(5, 40)).toBe("vertical");
  });
  it("taps, short swipes and long presses do not change the date", () => {
    expect(agendaSwipeAxis(4, 3)).toBeNull();
    expect(agendaSwipeDayDelta(63, 0, 300)).toBe(0);
    expect(agendaSwipeDayDelta(100, 0, 1201)).toBe(0);
  });
});
