import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finalizeBooking, type FinalizeBookingResult } from "@/lib/booking.functions";

const fake = vi.hoisted(() => ({
  middleware: {},
  adminFrom: vi.fn(),
  createGhlAppointment: vi.fn(),
  fetchFreeSlots: vi.fn(),
  runReceiptHook: vi.fn(),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: fake.middleware,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: fake.adminFrom },
}));
vi.mock("@/lib/booking.server", () => ({
  createGhlAppointment: fake.createGhlAppointment,
  fetchFreeSlots: fake.fetchFreeSlots,
  searchContactCandidates: vi.fn(),
  createGhlContact: vi.fn(),
  updateGhlContact: vi.fn(),
}));
vi.mock("@/lib/projects.server", () => ({
  findOpenOpportunities: vi.fn(),
  createOpportunity: vi.fn(),
  firstPipelineStageId: vi.fn(),
}));
vi.mock("@/lib/payment-mirror-hook.server", () => ({
  runReceiptHook: fake.runReceiptHook,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let middleware: unknown[] = [];
    let validator: ((input: unknown) => unknown) | null = null;
    const builder = {
      middleware: (value: unknown[]) => {
        middleware = value;
        return builder;
      },
      inputValidator: (value: (input: unknown) => unknown) => {
        validator = value;
        return builder;
      },
      handler: (handler: (args: unknown) => unknown) => ({
        run: (context: unknown, data: unknown) => {
          expect(middleware).toEqual([fake.middleware]);
          return handler({ context, data: validator ? validator(data) : data });
        },
      }),
    };
    return builder;
  },
}));

const artistId = "10000000-0000-4000-8000-000000000001";
const serviceId = "10000000-0000-4000-8000-000000000002";
const projectId = "10000000-0000-4000-8000-000000000003";
const input = {
  artistId,
  calendarId: "calendar-fixture",
  startISO: "2099-11-20T10:00:00.000Z",
  endISO: "2099-11-20T13:00:00.000Z",
  title: "Projeto fictício",
  services: [{ id: serviceId }],
  depositEur: 100,
  contact: { ghlContactId: "contact-fixture", name: "Cliente fictício" },
  project: { decision: "reuse", reuseProjectId: projectId },
  idempotencyKey: "booking-deposit-fixture",
};
type DbResult = { data: unknown; error: { message: string } | null };
type Write = { table: string; operation: string; value: Record<string, unknown> };

function database(paymentResult: DbResult | Error) {
  const writes: Write[] = [];
  function query(table: string, admin: boolean) {
    let operation = "read";
    function result(single: boolean): DbResult {
      if (table === "payments") {
        if (paymentResult instanceof Error) throw paymentResult;
        return paymentResult;
      }
      if (admin) {
        if (table === "contacts") return { data: { id: "local-contact" }, error: null };
        if (table === "appointments") return { data: { id: "local-appointment" }, error: null };
        if (table === "booking_operations") return { data: null, error: null };
      } else {
        if (table === "appointments") return { data: single ? null : [], error: null };
        if (table === "app_users") return { data: { role: "admin" }, error: null };
        if (table === "artists") {
          return {
            data: {
              id: artistId,
              active: true,
              ghl_calendar_id: input.calendarId,
              commission_pct: 40,
            },
            error: null,
          };
        }
        if (table === "services") {
          return {
            data: [
              {
                id: serviceId,
                name: "Sessão fictícia",
                duration_min: 180,
                modality: "tattoo",
                price_eur: 600,
                price_on_request: false,
              },
            ],
            error: null,
          };
        }
        if (table === "tattoo_projects")
          return {
            data: { id: projectId, ghl_opportunity_id: "opportunity-fixture" },
            error: null,
          };
      }
      throw new Error(`Unexpected query: ${admin ? "admin" : "user"}.${table}.${operation}`);
    }
    const q = {
      select: () => q,
      eq: () => q,
      neq: () => q,
      in: () => q,
      gte: () => q,
      lte: () => q,
      insert: (value: Record<string, unknown>) => {
        operation = "insert";
        writes.push({ table, operation, value });
        return q;
      },
      upsert: (value: Record<string, unknown>) => {
        operation = "upsert";
        writes.push({ table, operation, value });
        return q;
      },
      maybeSingle: async () => result(true),
      then: (resolve: (value: DbResult) => unknown) => Promise.resolve(result(false)).then(resolve),
    };
    return q;
  }
  fake.adminFrom.mockImplementation((table: string) => query(table, true));
  const supabase = { from: (table: string) => query(table, false) };
  return { context: { supabase, userId: "admin-fixture" }, writes };
}

function run(context: unknown, depositEur = 100) {
  return (
    finalizeBooking as unknown as {
      run: (context: unknown, data: unknown) => Promise<FinalizeBookingResult>;
    }
  ).run(context, { ...input, depositEur });
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.createGhlAppointment.mockResolvedValue({ id: "ghl-event-fixture" });
  fake.fetchFreeSlots.mockResolvedValue({ ok: true, slots: [input.startISO] });
  fake.runReceiptHook.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("booking deposit result after the appointment has been created", () => {
  it.each([
    { data: null, error: { message: "Supabase rejected the payment insert" } },
    { data: { id: "unconfirmed-payment" }, error: { message: "Supabase returned an error" } },
    { data: null, error: null },
    new Error("payment transport failed"),
  ])(
    "warns on an unconfirmed deposit without retrying or failing the booking: %j",
    async (paymentResult) => {
      const db = database(paymentResult);
      const result = await run(db.context);
      expect(result).toMatchObject({
        kind: "created",
        appointmentId: "local-appointment",
        ghlEventId: "ghl-event-fixture",
        totalEur: 600,
        warnings: [
          expect.stringContaining("Agendamento criado, pagamento do sinal não confirmado"),
        ],
      });
      expect(fake.createGhlAppointment).toHaveBeenCalledTimes(1);
      expect(db.writes.filter((w) => w.table === "appointments")).toHaveLength(1);
      expect(db.writes.filter((w) => w.table === "payments")).toEqual([
        expect.objectContaining({
          operation: "insert",
          value: expect.objectContaining({
            appointment_id: "local-appointment",
            amount_eur: 100,
            status: "paid",
            type: "deposit",
            created_by: "admin-fixture",
          }),
        }),
      ]);
      expect(db.writes.filter((w) => w.table === "booking_operations").at(-1)?.value).toMatchObject(
        { step: "persisted", status: "done", appointment_id: "local-appointment", error: null },
      );
      expect(fake.runReceiptHook).not.toHaveBeenCalled();
    },
  );

  it("runs the receipt hook only for a confirmed inserted payment ID", async () => {
    const db = database({ data: { id: "payment-fixture" }, error: null });
    await expect(run(db.context)).resolves.toMatchObject({ kind: "created", warnings: [] });
    expect(fake.runReceiptHook).toHaveBeenCalledExactlyOnceWith(db.context.supabase, [
      { source: "booking_deposit", id: "payment-fixture" },
    ]);
  });

  it("does not create a payment when no deposit was declared", async () => {
    const db = database({ data: null, error: null });
    await expect(run(db.context, 0)).resolves.toMatchObject({ kind: "created", warnings: [] });
    expect(db.writes.some((w) => w.table === "payments")).toBe(false);
    expect(fake.runReceiptHook).not.toHaveBeenCalled();
  });
});
