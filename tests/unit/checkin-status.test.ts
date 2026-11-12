import { describe, expect, it, vi } from "vitest";
import { checkinTransitionPatch } from "@/lib/checkin-policy";
import { getFilaHoje, setCheckinStatus, type CheckinStatus } from "@/lib/checkin.functions";

const fake = vi.hoisted(() => ({ middleware: {} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: fake.middleware,
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
const id = "20000000-0000-4000-8000-000000000001";
function run(fn: unknown, context: unknown, data?: unknown) {
  return (fn as { run: (context: unknown, data?: unknown) => Promise<unknown> }).run(context, data);
}
function database({
  role = "admin",
  status = "aguardando",
  missing = false,
  readError = false,
  zeroUpdated = false,
  updateError = false,
}: {
  role?: string;
  status?: CheckinStatus;
  missing?: boolean;
  readError?: boolean;
  zeroUpdated?: boolean;
  updateError?: boolean;
} = {}) {
  const calls: unknown[][] = [];
  let stage = 0;
  let patch: Record<string, unknown> = {};
  const staff = {
    select: () => staff,
    eq: () => staff,
    maybeSingle: async () => ({ data: { role }, error: null }),
  };
  const q = {
    select: (fields: string) => {
      calls.push(["select", fields]);
      return q;
    },
    eq: (field: string, value: string) => {
      calls.push(["eq", field, value]);
      return q;
    },
    update: (value: Record<string, unknown>) => {
      patch = value;
      calls.push(["update", value]);
      return q;
    },
    maybeSingle: async () =>
      stage++ === 0
        ? { data: missing ? null : { id, status }, error: readError ? new Error("read") : null }
        : {
            data: zeroUpdated ? null : { id, status: patch.status },
            error: updateError ? new Error("write") : null,
          },
  };
  const rpc = vi.fn(async () => ({ data: [] as Array<Record<string, unknown>>, error: null }));
  const from = vi.fn((table: string) => (table === "app_users" ? staff : q));
  return { context: { userId: "reception", supabase: { from, rpc } }, calls, from, rpc };
}

describe("check-in legal transitions", () => {
  it.each([
    ["aguardando", "em_atendimento"],
    ["aguardando", "nao_compareceu"],
    ["aguardando", "cancelado"],
    ["em_atendimento", "concluido"],
    ["em_atendimento", "cancelado"],
  ] as [CheckinStatus, CheckinStatus][])("permits %s -> %s", (current, next) => {
    expect(checkinTransitionPatch(current, next, new Date("2026-11-12T12:00:00Z")).status).toBe(
      next,
    );
  });
  it.each(["concluido", "nao_compareceu", "cancelado"] as CheckinStatus[])(
    "does not reopen or reconfirm terminal status %s",
    (current) => {
      for (const next of [
        "aguardando",
        "em_atendimento",
        "concluido",
        "nao_compareceu",
        "cancelado",
      ] as CheckinStatus[])
        expect(() => checkinTransitionPatch(current, next)).toThrow("transição");
    },
  );
  it("cannot skip straight from waiting to completion or overwrite the start by repeating it", () => {
    expect(() => checkinTransitionPatch("aguardando", "concluido")).toThrow();
    expect(() => checkinTransitionPatch("em_atendimento", "em_atendimento")).toThrow();
  });
  it("only stamps the lifecycle event actually being performed", () => {
    const now = new Date("2026-11-12T12:00:00Z");
    expect(checkinTransitionPatch("aguardando", "em_atendimento", now)).toEqual({
      status: "em_atendimento",
      started_at: now.toISOString(),
    });
    expect(checkinTransitionPatch("em_atendimento", "concluido", now)).toEqual({
      status: "concluido",
      finished_at: now.toISOString(),
    });
    expect(checkinTransitionPatch("em_atendimento", "cancelado", now)).toEqual({
      status: "cancelado",
    });
  });
});

describe("reception queue read and writes", () => {
  it.each(["artist", "seller", "unknown"])("rejects %s before queue access", async (role) => {
    const db = database({ role });
    await expect(run(getFilaHoje, db.context)).rejects.toThrow("recepção");
    await expect(
      run(setCheckinStatus, db.context, { id, status: "em_atendimento" }),
    ).rejects.toThrow("recepção");
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.from.mock.calls.every(([table]) => table === "app_users")).toBe(true);
  });
  it.each([
    { id: "not-uuid", status: "em_atendimento" },
    { id, status: "inventado" },
    { id, status: "em_atendimento", artistId: "forged" },
  ])("rejects invalid mutation input %j", (input) => {
    const db = database();
    expect(() => run(setCheckinStatus, db.context, input)).toThrow();
    expect(db.from).not.toHaveBeenCalled();
  });
  it("updates by immutable id AND observed status and requires a matching returned row", async () => {
    const db = database();
    await expect(
      run(setCheckinStatus, db.context, { id, status: "em_atendimento" }),
    ).resolves.toEqual({ ok: true });
    expect(db.calls).toContainEqual(["eq", "status", "aguardando"]);
    expect(
      db.calls.filter(
        ([operation, field, value]) => operation === "eq" && field === "id" && value === id,
      ),
    ).toHaveLength(2);
  });
  it.each([{ missing: true }, { readError: true }, { zeroUpdated: true }, { updateError: true }])(
    "does not claim success on absent, failed or concurrently changed row %j",
    async (options) => {
      const db = database(options);
      await expect(
        run(setCheckinStatus, db.context, { id, status: "em_atendimento" }),
      ).rejects.toThrow();
    },
  );
  it("keeps absent synchronization state unknown instead of assuming pending", async () => {
    const db = database();
    db.rpc.mockResolvedValue({
      data: [
        {
          id,
          cliente_nome: "Synthetic",
          codigo_atendimento: "DEMO",
          status: "aguardando",
          arrived_at: "2026-11-12T12:00:00Z",
          ghl_sync_status: null,
        },
      ],
      error: null,
    });
    await expect(run(getFilaHoje, db.context)).resolves.toMatchObject([{ syncStatus: null }]);
  });
  it("does not write after an illegal transition", async () => {
    const db = database({ status: "concluido" });
    await expect(
      run(setCheckinStatus, db.context, { id, status: "em_atendimento" }),
    ).rejects.toThrow();
    expect(db.calls.some(([operation]) => operation === "update")).toBe(false);
  });
});
