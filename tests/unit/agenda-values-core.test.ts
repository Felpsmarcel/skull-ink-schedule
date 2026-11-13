import { describe, expect, it } from "vitest";
import { RANDEVU_CALENDAR_ID } from "@/lib/artist-commission-policy";
import {
  agendaMoneyCents,
  agendaValueForEvent,
  summarizeAgendaValues,
  type AgendaValueEvent,
  type AgendaValueItem,
  type AgendaValuesSource,
} from "@/lib/agenda-values-core";

const event: AgendaValueEvent = {
  id: "ghl-event-1",
  artistId: "artist-1",
  calendarId: "calendar-1",
  startTime: "2026-11-13T09:00:00Z",
  status: "confirmed",
};
const item: AgendaValueItem = {
  ghlEventId: event.id,
  artistId: event.artistId,
  calendarId: event.calendarId,
  startTime: event.startTime,
  totalCents: 50000,
  depositCents: 10000,
  projectId: "project-1",
};
const source = (items = [item]): AgendaValuesSource => ({ state: "ready", items });

describe("agenda monetary annotations", () => {
  it.each([
    ["12.34", 1234],
    [12.34, 1234],
    [0, 0],
    ["0.1", 10],
    ["12", 1200],
    [null, null],
    [undefined, null],
    ["", null],
    [" 10", null],
    ["-1", null],
    [-1, null],
    [Infinity, null],
    [NaN, null],
    ["1e3", null],
    [1.001, null],
    [Number.MAX_SAFE_INTEGER, null],
    ["90071992547409.91", Number.MAX_SAFE_INTEGER],
    ["90071992547409.92", null],
    [true, null],
  ])("validates %s without rounding or manufacturing zeros", (input, expected) => {
    expect(agendaMoneyCents(input)).toBe(expected);
  });
  it("deduplicates a multi-slot event and never calls its annotations paid", () => {
    expect(summarizeAgendaValues([event, event, event], source())).toEqual({
      includedCount: 1,
      excludedCount: 0,
      unknownCount: 0,
      totalCents: 50000,
      depositCents: 10000,
      differenceCents: 40000,
      paymentProof: false,
    });
  });
  it("keeps two sessions in the same project as independent session annotations", () => {
    expect(
      summarizeAgendaValues(
        [event, { ...event, id: "event-2" }],
        source([item, { ...item, ghlEventId: "event-2", totalCents: 20000, depositCents: 0 }]),
      ).totalCents,
    ).toBe(70000);
  });
  it.each([
    { artistId: "artist-2" },
    { calendarId: "calendar-2" },
    { id: "event-2" },
    { startTime: "2026-11-14T09:00:00Z" },
    { startTime: "2026-11-13T09:00:00" },
  ])("requires event, artist, calendar and exact instant (%j)", (override) => {
    expect(agendaValueForEvent({ ...event, ...override }, source())).toBeNull();
    expect(summarizeAgendaValues([{ ...event, ...override }], source())).toMatchObject({
      totalCents: null,
      depositCents: null,
      differenceCents: null,
      unknownCount: 1,
    });
  });
  it("accepts equivalent explicit timezone offsets", () => {
    expect(
      agendaValueForEvent({ ...event, startTime: "2026-11-13T10:00:00+01:00" }, source()),
    ).toEqual(item);
  });
  it("rejects an impossible civil date even when both sources normalize to the same instant", () => {
    expect(
      agendaValueForEvent(
        { ...event, startTime: "2026-03-02T09:00:00Z" },
        source([{ ...item, startTime: "2026-02-30T09:00:00Z" }]),
      ),
    ).toBeNull();
  });
  it.each(["cancel", "cancelled", "canceled", "no_show", "noshow", "no-show", "No Show"])(
    "excludes %s",
    (status) => {
      expect(summarizeAgendaValues([{ ...event, status }], source())).toMatchObject({
        includedCount: 0,
        excludedCount: 1,
        totalCents: 0,
        depositCents: 0,
        differenceCents: 0,
      });
    },
  );
  it("excludes Randevu by its immutable calendar ID", () => {
    expect(
      summarizeAgendaValues([{ ...event, calendarId: RANDEVU_CALENDAR_ID }], source())
        .excludedCount,
    ).toBe(1);
  });
  it.each([
    { totalCents: null },
    { depositCents: null },
    { depositCents: 50001 },
    { totalCents: -1 },
    { depositCents: 0.5 },
  ])(
    "does not produce complete aggregates from unknown/conflicting annotations (%j)",
    (override) => {
      expect(summarizeAgendaValues([event], source([{ ...item, ...override }]))).toMatchObject({
        unknownCount: 1,
        totalCents: null,
        depositCents: null,
        differenceCents: null,
      });
    },
  );
  it("invalidates duplicate local mappings, including identical duplicate values", () => {
    expect(agendaValueForEvent(event, source([item, item]))).toBeNull();
    expect(summarizeAgendaValues([event], source([item, item])).totalCents).toBeNull();
  });
  it("invalidates conflicting event identities or statuses regardless of order", () => {
    const conflicting = { ...event, status: "cancelled" };
    for (const events of [
      [event, conflicting],
      [conflicting, event],
    ]) {
      expect(summarizeAgendaValues(events, source())).toMatchObject({
        includedCount: 1,
        excludedCount: 0,
        unknownCount: 1,
        totalCents: null,
      });
    }
  });
  it("does not expose a partial sum when one displayed event has no mapping", () => {
    expect(summarizeAgendaValues([event, { ...event, id: "unmapped" }], source())).toMatchObject({
      includedCount: 2,
      unknownCount: 1,
      totalCents: null,
      depositCents: null,
      differenceCents: null,
    });
  });
  it("distinguishes verified empty rows from an incomplete query", () => {
    expect(summarizeAgendaValues([], source([])).totalCents).toBe(0);
    expect(summarizeAgendaValues([], source([]), false).totalCents).toBeNull();
    expect(
      summarizeAgendaValues([], { state: "unavailable", items: [], reason: "unavailable" })
        .totalCents,
    ).toBeNull();
  });
  it("does not total an overflowing safe-integer aggregate", () => {
    const large = { ...item, totalCents: Number.MAX_SAFE_INTEGER, depositCents: 0 };
    expect(
      summarizeAgendaValues(
        [event, { ...event, id: "event-2" }],
        source([large, { ...large, ghlEventId: "event-2" }]),
      ).totalCents,
    ).toBeNull();
  });
});
