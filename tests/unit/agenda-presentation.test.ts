import { describe, it, expect } from "vitest";
import {
  agendaEntries,
  readAgendaEntries,
  agendaOperationSummary,
  eventGridSlot,
  entryDay,
  appointmentState,
} from "@/lib/agenda-presentation";
import { brusselsAddDays, brusselsWeekStartMs, enumerateBrusselsDays } from "@/lib/agenda-grid";
import type { StaffMember } from "@/config/staff";
const staff: StaffMember = {
  id: "artist-a",
  name: "Example",
  shortName: "Example",
  calendarId: "cal-a",
  initials: "EX",
  color: "",
};
const event = {
  id: "event-a",
  startTime: "2026-11-12T09:00:00Z",
  endTime: "2026-11-12T12:00:00Z",
  appointmentStatus: "confirmed",
  contact: { id: "contact-a", name: "Example client" },
};
describe("agenda presentation", () => {
  it("counts a three-hour session once, not as six slots", () => {
    const entries = agendaEntries(
      [{ staff, events: [event, event] }],
      Date.parse("2026-11-11T23:00:00Z"),
      Date.parse("2026-11-12T23:00:00Z"),
    );
    expect(entries).toHaveLength(1);
    expect(agendaOperationSummary(entries)).toEqual({
      count: 1,
      active: 1,
      confirmed: 1,
      rate: 100,
    });
    expect(eventGridSlot(entries[0])).toMatchObject({
      contactId: "contact-a",
      ghlEventId: "event-a",
      eventStartMs: Date.parse(event.startTime),
      eventEndMs: Date.parse(event.endTime),
    });
  });
  it("uses Brussels day and excludes the end boundary", () => {
    const ev = { ...event, startTime: "2026-11-11T23:30:00Z" };
    const entries = agendaEntries(
      [{ staff, events: [ev, { ...event, id: "next", startTime: "2026-11-12T23:00:00Z" }] }],
      Date.parse("2026-11-11T23:00:00Z"),
      Date.parse("2026-11-12T23:00:00Z"),
    );
    expect(entries).toHaveLength(1);
    expect(entryDay(entries[0])).toBe("2026-11-12");
  });
  it("keeps distinct same-client appointments and canceled cards", () => {
    const entries = agendaEntries(
      [
        {
          staff,
          events: [
            event,
            { ...event, id: "second", appointmentStatus: "cancelled" },
            { ...event, id: "third", appointmentStatus: "new" },
          ],
        },
      ],
      Date.parse("2026-11-12T00:00:00Z"),
      Date.parse("2026-11-13T00:00:00Z"),
    );
    expect(agendaOperationSummary(entries)).toEqual({
      count: 3,
      active: 2,
      confirmed: 1,
      rate: 50,
    });
  });
  it.each(["no-show", "no_show", "noshow", "cancelled", "canceled"])(
    "does not count %s as confirmation",
    (status) => expect(appointmentState(status).excluded).toBe(true),
  );
  it("does not invent a confirmation rate for empty data", () =>
    expect(agendaOperationSummary([]).rate).toBeNull());
  it.each(["2026-03-29T12:00:00Z", "2026-10-25T12:00:00Z"])(
    "builds seven civil days across DST %s",
    (date) => {
      const start = brusselsWeekStartMs(new Date(date));
      const days = enumerateBrusselsDays(start, brusselsAddDays(start, 7));
      expect(days).toHaveLength(7);
      expect(new Set(days).size).toBe(7);
      expect(brusselsAddDays(start, 7) - start).not.toBe(7 * 86400000);
    },
  );
});

describe("agenda source conflicts", () => {
  const start = Date.parse("2026-11-12T00:00:00Z");
  const end = Date.parse("2026-11-13T00:00:00Z");
  it.each([false, true])(
    "flags contradictory duplicates regardless of response order (%s)",
    (reverse) => {
      const rows = [event, { ...event, appointmentStatus: "cancelled" }];
      const read = readAgendaEntries(
        [{ staff, events: reverse ? rows.reverse() : rows }],
        start,
        end,
      );
      expect(read.hasIssues).toBe(true);
      expect(read.entries).toHaveLength(1);
      expect(read.entries[0].issue).toBe(true);
    },
  );
  it("identical repeated records remain one valid appointment", () => {
    expect(
      readAgendaEntries([{ staff, events: [event, { ...event }] }], start, end).hasIssues,
    ).toBe(false);
  });
  it.each([
    { ...event, id: "" },
    { ...event, startTime: "invalid" },
  ])("does not convert malformed records into verified empty data", (row) => {
    const read = readAgendaEntries([{ staff, events: [row] }], start, end);
    expect(read.entries).toEqual([]);
    expect(read.hasIssues).toBe(true);
  });
  it("flags a record returned by a different calendar", () => {
    const read = readAgendaEntries(
      [{ staff, events: [{ ...event, calendarId: "other" }] }],
      start,
      end,
    );
    expect(read.hasIssues).toBe(true);
    expect(read.entries[0].issue).toBe(true);
  });
});

it("keeps out-of-period duplicate conflict visible to the summary guard", () => {
  const read = readAgendaEntries(
    [
      {
        staff,
        events: [
          event,
          { ...event, startTime: "2026-11-14T09:00:00Z", endTime: "2026-11-14T12:00:00Z" },
        ],
      },
    ],
    Date.parse("2026-11-12T00:00:00Z"),
    Date.parse("2026-11-13T00:00:00Z"),
  );
  expect(read.hasIssues).toBe(true);
});
