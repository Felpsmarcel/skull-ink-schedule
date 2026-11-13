import { describe, expect, it, vi } from "vitest";
import { agendaValuesRangeSchema, getAgendaValues } from "@/lib/agenda-values.functions";
import type { AgendaValuesSource } from "@/lib/agenda-values-core";

const auth = vi.hoisted(() => ({ middleware: {} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: auth.middleware,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: ({ method }: { method: string }) => {
    let middleware: unknown[] = [];
    let validate: (input: unknown) => unknown = (input) => input;
    const builder = {
      middleware: (value: unknown[]) => {
        middleware = value;
        return builder;
      },
      inputValidator: (validator: typeof validate) => {
        validate = validator;
        return builder;
      },
      handler: (handler: (input: unknown) => unknown) => ({
        run: (context: unknown, input: unknown) => {
          expect(method).toBe("GET");
          expect(middleware).toEqual([auth.middleware]);
          return handler({ context, data: validate(input) });
        },
      }),
    };
    return builder;
  },
}));

const range = { startISO: "2026-11-12T23:00:00Z", endISO: "2026-11-13T23:00:00Z" };
const annotation = {
  id: "local-1",
  artist_id: "artist-1",
  calendar_id: "calendar-1",
  ghl_appointment_id: "ghl-1",
  start_at: "2026-11-13T09:00:00Z",
  total_eur: 500,
  deposit_eur: 100,
  project_id: "project-1",
};
function fixture({
  profile = { role: "admin" } as unknown,
  rows = [annotation] as Record<string, unknown>[],
  profileError = null as unknown,
  pageError = null as unknown,
  counts = undefined as Array<number | null> | undefined,
  pageCap = 250,
} = {}) {
  const calls: {
    table: string;
    fields: string;
    filters: unknown[];
    ranges: number[][];
    count: unknown;
  }[] = [];
  let pageNumber = 0;
  const from = (table: string) => {
    const call = {
      table,
      fields: "",
      filters: [] as unknown[],
      ranges: [] as number[][],
      count: undefined as unknown,
    };
    calls.push(call);
    const query = {
      select: (fields: string, options?: unknown) => {
        call.fields = fields;
        call.count = options;
        return query;
      },
      eq: (field: string, value: unknown) => {
        call.filters.push(["eq", field, value]);
        return query;
      },
      gte: (field: string, value: unknown) => {
        call.filters.push(["gte", field, value]);
        return query;
      },
      lt: (field: string, value: unknown) => {
        call.filters.push(["lt", field, value]);
        return query;
      },
      order: (field: string) => {
        call.filters.push(["order", field]);
        return query;
      },
      maybeSingle: async () => ({ data: profile, error: profileError }),
      range: async (first: number, last: number) => {
        call.ranges.push([first, last]);
        return {
          data: rows.slice(first, Math.min(last + 1, first + pageCap)),
          error: pageError,
          count: counts ? counts[Math.min(pageNumber++, counts.length - 1)] : rows.length,
        };
      },
    };
    return query;
  };
  return {
    calls,
    run: (input: unknown = range) =>
      (
        getAgendaValues as unknown as {
          run: (context: unknown, input: unknown) => Promise<AgendaValuesSource>;
        }
      ).run({ userId: "authenticated-admin", supabase: { from } }, input),
  };
}

describe("agenda annotation server boundaries", () => {
  it.each([null, {}, { role: "artist" }, { role: "seller" }, { role: "unknown" }])(
    "denies %j before querying money",
    async (profile) => {
      const app = fixture({ profile });
      await expect(app.run()).rejects.toMatchObject({ status: 403 });
      expect(app.calls.map((call) => call.table)).toEqual(["app_users"]);
    },
  );
  it("denies an errored admin profile", async () => {
    const app = fixture({ profileError: new Error("error") });
    await expect(app.run()).rejects.toMatchObject({ status: 403 });
    expect(app.calls).toHaveLength(1);
  });
  it("uses the authenticated identity and a complete half-open ordered local read", async () => {
    const app = fixture();
    expect(await app.run()).toEqual({
      state: "ready",
      items: [
        {
          ghlEventId: "ghl-1",
          artistId: "artist-1",
          calendarId: "calendar-1",
          startTime: annotation.start_at,
          totalCents: 50000,
          depositCents: 10000,
          projectId: "project-1",
        },
      ],
    });
    expect(app.calls[0].filters).toEqual([["eq", "id", "authenticated-admin"]]);
    expect(app.calls[1].count).toEqual({ count: "exact" });
    expect(app.calls[1].filters).toEqual([
      ["gte", "start_at", range.startISO],
      ["lt", "start_at", range.endISO],
      ["order", "id"],
    ]);
    expect(app.calls[1].fields).not.toMatch(/contact|note|commission|payment_status|opportun/);
  });
  it("walks multiple complete pages", async () => {
    const rows = Array.from({ length: 251 }, (_, index) => ({
      ...annotation,
      id: `local-${index}`,
      ghl_appointment_id: `event-${index}`,
    }));
    const app = fixture({ rows });
    const result = await app.run();
    expect(result.state).toBe("ready");
    expect(result.items).toHaveLength(251);
    expect(app.calls.filter((call) => call.table === "appointments")).toHaveLength(2);
  });
  it.each([
    { counts: [null] },
    { counts: [2] },
    { pageError: "query failed" },
    { rows: [annotation, annotation] },
    { rows: [annotation, { ...annotation, id: "other" }] },
    { rows: [{ ...annotation, calendar_id: null }] },
    { rows: [{ ...annotation, artist_id: " " }] },
    { rows: [{ ...annotation, start_at: range.endISO }] },
    { rows: [{ ...annotation, start_at: "2026-11-12T22:59:59Z" }] },
  ])("fails closed for incomplete/conflicting source %j", async (options) => {
    expect(await fixture(options).run()).toMatchObject({ state: "unavailable", items: [] });
  });
  it("rejects count changes while paginating", async () => {
    const rows = Array.from({ length: 251 }, (_, index) => ({
      ...annotation,
      id: `local-${index}`,
      ghl_appointment_id: `event-${index}`,
    }));
    expect(await fixture({ rows, counts: [251, 252] }).run()).toMatchObject({
      state: "unavailable",
      items: [],
    });
    expect(await fixture({ rows, pageCap: 100 }).run()).toMatchObject({
      state: "unavailable",
      items: [],
    });
  });
  it("does not convert imported defaults into a free session", async () => {
    expect(
      await fixture({ rows: [{ ...annotation, total_eur: 0, deposit_eur: 0 }] }).run(),
    ).toMatchObject({
      state: "ready",
      items: [{ totalCents: null, depositCents: null }],
    });
  });
  it("retains a zero annotated deposit for a priced session and never queries project money", async () => {
    const app = fixture({ rows: [{ ...annotation, deposit_eur: 0 }] });
    expect(await app.run()).toMatchObject({ items: [{ totalCents: 50000, depositCents: 0 }] });
    expect(app.calls.map((call) => call.table)).toEqual(["app_users", "appointments"]);
  });
  it("turns malformed amounts into null instead of rounding or zero", async () => {
    expect(
      await fixture({ rows: [{ ...annotation, total_eur: "12.001", deposit_eur: -1 }] }).run(),
    ).toMatchObject({
      state: "ready",
      items: [{ totalCents: null, depositCents: null }],
    });
  });
  it("ignores local-only appointments without inventing a CRM identity", async () => {
    expect(
      await fixture({
        rows: [{ ...annotation, ghl_appointment_id: null, calendar_id: null }],
      }).run(),
    ).toEqual({ state: "ready", items: [] });
  });
});

describe("agenda values range validation", () => {
  it.each([
    {},
    { ...range, artistId: "other" },
    { ...range, startISO: "2026-11-13" },
    { ...range, startISO: "2026-11-13T10:00:00" },
    { ...range, endISO: range.startISO },
    { ...range, startISO: range.endISO, endISO: range.startISO },
    { ...range, endISO: "2027-01-01T00:00:00Z" },
    { ...range, startISO: "2026-02-30T00:00:00Z" },
  ])("rejects invalid/oversized/client-scoped input %j", (input) => {
    expect(agendaValuesRangeSchema.safeParse(input).success).toBe(false);
  });
  it("accepts 42 Brussels days crossing the 25-hour autumn day", () => {
    expect(
      agendaValuesRangeSchema.safeParse({
        startISO: "2026-09-30T22:00:00Z",
        endISO: "2026-11-11T23:00:00Z",
      }).success,
    ).toBe(true);
    expect(
      agendaValuesRangeSchema.safeParse({
        startISO: "2026-09-30T22:00:00Z",
        endISO: "2026-11-11T23:00:01Z",
      }).success,
    ).toBe(false);
  });
  it("validates before invoking the server handler", () => {
    const app = fixture();
    expect(() => app.run({ ...range, endISO: "invalid" })).toThrow();
    expect(app.calls).toEqual([]);
  });
});
