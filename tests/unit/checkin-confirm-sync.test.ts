import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { confirmarChegada } from "@/lib/checkin.functions";

const fake = vi.hoisted(() => ({ middleware: {}, from: vi.fn(), rpc: vi.fn(), sync: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: fake.middleware,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: fake.from, rpc: fake.rpc },
}));
vi.mock("@/lib/checkin-ghl.server", () => ({ syncCheckinToGhl: fake.sync }));
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
      handler: (fn: (args: unknown) => unknown) => ({
        run: (context: unknown, input: unknown) => {
          expect(middleware).toEqual([fake.middleware]);
          return fn({ context, data: validator ? validator(input) : input });
        },
      }),
    };
    return builder;
  },
}));
const contactId = "10000000-0000-4000-8000-000000000001";
const appointmentId = "20000000-0000-4000-8000-000000000002";
const artistId = "30000000-0000-4000-8000-000000000003";
const record = {
  id: "arrival-id",
  codigo_atendimento: "DEMO-01",
  qr_token: "fake-token",
  qr_url: "https://invalid.example/synthetic-only",
  scheduled_at: "2026-11-12T10:00:00Z",
};
const staff = {
  select: () => staff,
  eq: () => staff,
  maybeSingle: async () => ({ data: { role: "admin" }, error: null }),
};
const context = { userId: "reception", supabase: { from: () => staff } };
let inserted: Record<string, unknown>[];
let updates: Record<string, unknown>[];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-12T09:00:00Z"));
  inserted = [];
  updates = [];
  fake.rpc.mockReset().mockResolvedValue({ data: "DEMO-01", error: null });
  fake.sync.mockReset().mockResolvedValue({
    ok: true,
    ghlContactId: "canonical-contact",
    ghlAppointmentId: "canonical-selected-event",
    workflowTriggered: true,
    steps: [],
  });
  fake.from.mockReset().mockImplementation((table: string) => {
    const q = {
      select: () => q,
      eq: () => q,
      in: () => q,
      gte: () => q,
      lt: () => q,
      limit: () => q,
      is: () => q,
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return q;
      },
      update: (row: Record<string, unknown>) => {
        updates.push(row);
        return q;
      },
      single: async () => ({ data: record, error: null }),
      maybeSingle: async () => ({
        data:
          table === "contacts"
            ? {
                id: contactId,
                name: "Nome canônico",
                phone: null,
                ghl_contact_id: "canonical-contact",
              }
            : table === "appointments"
              ? {
                  id: appointmentId,
                  contact_id: contactId,
                  artist_id: artistId,
                  status: "confirmed",
                  start_at: record.scheduled_at,
                  ghl_appointment_id: "canonical-selected-event",
                }
              : null,
        error: null,
      }),
    };
    return q;
  });
});
afterEach(() => vi.useRealTimers());

function run(input: unknown) {
  return (
    confirmarChegada as unknown as { run: (context: unknown, input: unknown) => Promise<unknown> }
  ).run(context, input);
}

describe("arrival handler sync contract — all transports mocked", () => {
  it.each([false, true])(
    "passes canonical IDs and consent %s without inventing delivery",
    async (consentimento) => {
      await run({
        nome: "Label do navegador",
        contactId,
        appointmentId,
        ghlContactId: "forged-contact",
        consentimento,
      });
      expect(inserted[0]).toMatchObject({
        appointment_id: appointmentId,
        ghl_contact_id: "canonical-contact",
        consentimento_comunicacao: consentimento,
      });
      expect(fake.sync).toHaveBeenCalledWith(
        expect.objectContaining({
          clienteNome: "Nome canônico",
          ghlContactId: "canonical-contact",
          ghlAppointmentId: "canonical-selected-event",
          consentimento,
        }),
      );
      expect(updates).toHaveLength(1);
      expect(updates[0]).not.toHaveProperty("notificado_em");
      expect(updates[0]).toMatchObject({
        ghl_appointment_id: "canonical-selected-event",
        ghl_opportunity_id: null,
      });
    },
  );
  it("preserves a new local arrival when its contact cannot be synchronized", async () => {
    fake.sync.mockResolvedValue({ ok: false, error: "Vínculo não confirmado", steps: [] });
    const result = await run({ nome: "Pessoa fictícia", consentimento: false });
    expect(inserted).toHaveLength(1);
    expect(fake.sync).toHaveBeenCalledWith(
      expect.objectContaining({ ghlContactId: null, ghlAppointmentId: null, consentimento: false }),
    );
    expect(result).toMatchObject({
      token: record.qr_token,
      codigo: record.codigo_atendimento,
      jaExistia: false,
    });
    expect(updates[0]).toMatchObject({ ghl_sync_status: "failed", ghl_last_synced_at: null });
    expect(updates[0]).not.toHaveProperty("notificado_em");
  });
});
