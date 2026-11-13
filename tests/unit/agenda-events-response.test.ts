import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseAgendaEventsResponse } from "@/lib/agenda-events-response";
import { useStaffDayAgenda } from "@/hooks/use-agenda";
import { useStaffRangeAgenda } from "@/hooks/use-agenda-range";

const state = vi.hoisted(() => ({
  response: {} as unknown,
  results: [] as unknown[],
  queries: [] as Array<{ queryFn: () => Promise<unknown> }>,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueries: ({ queries }: { queries: typeof state.queries }) => {
    state.queries = queries;
    return queries.map((_, index) => ({
      data: state.results[index],
      isLoading: !state.results[index],
      isError: false,
      isFetching: false,
    }));
  },
}));
vi.mock("@/hooks/use-artists", () => ({
  useArtists: () => ({
    data: [{ id: "artist-a", calendarId: "calendar-a", name: "Artist A" }],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/lib/ghl", () => ({
  getEvents: async () => ({ ok: true, status: 200, data: state.response }),
  getFreeSlots: async () => ({
    ok: true,
    status: 200,
    data: { "2026-11-13": { slots: ["2026-11-13T09:00:00Z"] } },
  }),
}));

const event = {
  id: "event-a",
  calendarId: "calendar-a",
  contactId: "contact-a",
  contact: { id: "contact-a", name: "Client A" },
  startTime: "2026-11-13T10:00:00+01:00",
  endTime: "2026-11-13T11:00:00+01:00",
  appointmentStatus: "confirmed",
  title: "Session A",
};
const invalidEnvelopes: unknown[] = [
  undefined,
  null,
  {},
  [],
  { events: null },
  { events: {} },
  { events: "[]" },
];

beforeEach(() => {
  state.response = {};
  state.results = [];
  state.queries = [];
});

describe("calendar response validation", () => {
  it("accepts an explicit empty events array", () => {
    expect(parseAgendaEventsResponse({ events: [], traceId: "trace" }, "calendar-a")).toEqual([]);
  });
  it("preserves validated appointment identity and display fields", () => {
    expect(parseAgendaEventsResponse({ events: [event] }, "calendar-a")).toEqual([event]);
  });
  it("accepts missing optional inline fields and normalizes nullable display fields", () => {
    const minimal = {
      id: event.id,
      startTime: event.startTime,
      endTime: event.endTime,
      contact: null,
      title: null,
    };
    expect(parseAgendaEventsResponse({ events: [minimal] }, "calendar-a")).toMatchObject([
      {
        id: event.id,
        startTime: event.startTime,
        endTime: event.endTime,
        contact: undefined,
        title: undefined,
      },
    ]);
  });
  it.each(invalidEnvelopes)(
    "rejects an invalid envelope without manufacturing empty success: %j",
    (envelope) => {
      expect(() => parseAgendaEventsResponse(envelope, "calendar-a")).toThrow();
    },
  );
  it.each([
    null,
    false,
    "event",
    {},
    { ...event, id: "" },
    { ...event, id: " event-a" },
    { ...event, startTime: "invalid" },
    { ...event, startTime: "2026-02-30T10:00:00Z" },
    { ...event, startTime: "2026-11-13T10:00:00" },
    { ...event, endTime: null },
    { ...event, endTime: event.startTime },
    { ...event, endTime: "2026-11-13T08:00:00Z" },
    { ...event, calendarId: "calendar-b" },
    { ...event, contact: { id: "contact-b" } },
    { ...event, contact: { name: {} } },
    { ...event, title: {} },
    { ...event, appointmentStatus: {} },
  ])("rejects malformed rows without returning the valid subset: %j", (row) => {
    expect(() => parseAgendaEventsResponse({ events: [event, row] }, "calendar-a")).toThrow();
  });
});

describe("agenda query integration", () => {
  it("keeps an undefined payload partial instead of crashing the day debug projection", async () => {
    state.response = undefined;
    const day = new Date("2026-11-13T12:00:00Z");
    useStaffDayAgenda(day);
    state.results = [await state.queries[0].queryFn()];
    const rendered = useStaffDayAgenda(day);
    expect(rendered.hasError).toBe(true);
    expect(rendered.agendas[0]).toMatchObject({
      events: [],
      error: expect.any(String),
      isLoading: false,
    });
  });
  it.each(invalidEnvelopes)(
    "marks the day query partial despite available free slots: %j",
    async (response) => {
      state.response = response;
      useStaffDayAgenda(new Date("2026-11-13T12:00:00Z"));
      const result = await state.queries[0].queryFn();
      expect(result).toMatchObject({
        events: [],
        partialError: expect.stringContaining("events:"),
      });
    },
  );
  it.each(invalidEnvelopes)(
    "rejects week/month query success with invalid envelopes: %j",
    async (response) => {
      state.response = response;
      useStaffRangeAgenda(Date.parse(event.startTime), Date.parse(event.endTime));
      await expect(state.queries[0].queryFn()).rejects.toThrow();
    },
  );
  it("accepts explicit empty rows in both day and range queries", async () => {
    state.response = { events: [] };
    useStaffDayAgenda(new Date("2026-11-13T12:00:00Z"));
    expect(await state.queries[0].queryFn()).toMatchObject({
      events: [],
      error: undefined,
      partialError: undefined,
    });
    useStaffRangeAgenda(Date.parse(event.startTime), Date.parse(event.endTime));
    expect(await state.queries[0].queryFn()).toEqual([]);
  });
  it("rejects a malformed row before the day grid or month grouping can render it", async () => {
    state.response = { events: [null] };
    useStaffDayAgenda(new Date("2026-11-13T12:00:00Z"));
    expect(await state.queries[0].queryFn()).toMatchObject({ partialError: expect.any(String) });
    useStaffRangeAgenda(Date.parse(event.startTime), Date.parse(event.endTime));
    await expect(state.queries[0].queryFn()).rejects.toThrow();
  });
});
