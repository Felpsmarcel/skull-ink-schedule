import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  role: "admin" as string | null,
  missingProfile: false,
  profileError: null as { message: string } | null,
  order: [] as string[],
  userFrom: vi.fn(),
  serviceFrom: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  sync: vi.fn(),
  hook: vi.fn(),
  header: vi.fn(),
}));

// Execute the real handler and Zod validator; replace framework transport and external adapters only.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: ((input: unknown) => unknown) | undefined;
    const builder = {
      middleware: () => builder,
      inputValidator: (input: (data: unknown) => unknown) => {
        validator = input;
        return builder;
      },
      handler: (handler: (args: unknown) => unknown) => ({
        run: async (input: unknown, context: unknown) =>
          handler({ data: validator ? validator(input) : input, context }),
      }),
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: fake.header }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: fake.serviceFrom },
}));
vi.mock("@/lib/movimentacao-ghl.server", () => ({ syncMovimentacaoToGhl: fake.sync }));
vi.mock("@/lib/payment-mirror-hook.server", () => ({ runReceiptHook: fake.hook }));

import { createMovimentacaoManual } from "@/lib/movimentacao.functions";

const USER = "00000000-0000-4000-8000-000000000001";
const ARTIST = "00000000-0000-4000-8000-000000000002";
const PROJECT = "00000000-0000-4000-8000-000000000003";
const RECEIPT = "00000000-0000-4000-8000-000000000004";
const INPUT = {
  nome_cliente: "Cliente fictício",
  data_pagamento: "2026-11-04",
  artist_id: ARTIST,
  tipo_movimento: "sessao",
  recebido_por_id: "gabriel",
  valor_dinheiro: 123,
  chave_idempotencia: "00000000-0000-4000-8000-000000000005",
  project_id: PROJECT,
};
const context = () => ({ userId: USER, supabase: { from: fake.userFrom } });
const run = (ctx = context()) =>
  (
    createMovimentacaoManual as unknown as {
      run: (data: unknown, context: unknown) => Promise<unknown>;
    }
  ).run(INPUT, ctx);

beforeEach(() => {
  vi.clearAllMocks();
  fake.role = "admin";
  fake.missingProfile = false;
  fake.profileError = null;
  fake.order = [];
  fake.header.mockReturnValue(undefined);
  fake.sync.mockResolvedValue({ ok: true, ghl_custom_object_id: "fictitious-object" });
  fake.hook.mockResolvedValue(undefined);
  fake.userFrom.mockImplementation((table: string) => {
    fake.order.push(`user:${table}`);
    expect(table).toBe("app_users");
    return {
      select: (columns: string) => {
        expect(columns).toBe("role, artist_id, seller_id");
        return {
          eq: (column: string, value: string) => {
            expect([column, value]).toEqual(["id", USER]);
            return {
              maybeSingle: async () => ({
                data: fake.missingProfile
                  ? null
                  : { role: fake.role, artist_id: ARTIST, seller_id: null },
                error: fake.profileError,
              }),
            };
          },
        };
      },
    };
  });
  fake.serviceFrom.mockImplementation((table: string) => {
    fake.order.push(`service:${table}`);
    const query = {
      select: () => query,
      eq: () => query,
      insert: (payload: unknown) => {
        fake.insert(payload);
        return query;
      },
      update: (payload: unknown) => {
        fake.update(payload);
        return query;
      },
      maybeSingle: async () => ({
        data:
          table === "tattoo_projects"
            ? {
                id: PROJECT,
                contact_id: null,
                ghl_contact_id: "fictitious-contact",
                ghl_opportunity_id: "fictitious-project",
              }
            : table === "artists"
              ? { id: ARTIST, name: "Artista fictício" }
              : null,
        error: null,
      }),
      single: async () => ({ data: { id: RECEIPT, total: 123 }, error: null }),
      then: (resolve: (data: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve),
    };
    return query;
  });
});

function expectNoPrivilegedEffects() {
  expect(fake.serviceFrom).not.toHaveBeenCalled(); // Also proves link resolution's privileged project read did not run.
  expect(fake.insert).not.toHaveBeenCalled();
  expect(fake.update).not.toHaveBeenCalled();
  expect(fake.sync).not.toHaveBeenCalled();
  expect(fake.hook).not.toHaveBeenCalled();
  expect(fake.header).not.toHaveBeenCalled();
}

describe("createMovimentacaoManual authorization", () => {
  it.each(["artist", "seller", "unknown", "ADMIN", "", null])(
    "denies role %s before links, service writes, GHL or mirror hook",
    async (role) => {
      fake.role = role;
      await expect(run()).rejects.toThrow("Forbidden");
      expect(fake.order).toEqual(["user:app_users"]);
      expectNoPrivilegedEffects();
    },
  );
  it("fails closed when the authenticated user's profile is absent", async () => {
    fake.missingProfile = true;
    await expect(run()).rejects.toThrow("Forbidden");
    expectNoPrivilegedEffects();
  });
  it("fails closed on profile read error before any privileged operation", async () => {
    fake.profileError = { message: "fictional profile read failure" };
    await expect(run()).rejects.toThrow("fictional profile read failure");
    expectNoPrivilegedEffects();
  });
  it("admin retains the real insert/sync/hook flow only after a verified profile read", async () => {
    await expect(run()).resolves.toMatchObject({
      id: RECEIPT,
      ids: [RECEIPT],
      ghl_sync_status: "synced",
    });
    expect(fake.order[0]).toBe("user:app_users");
    expect(fake.order[1]).toBe("service:tattoo_projects");
    expect(fake.insert).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        nome_cliente: "Cliente fictício",
        registrado_por_app_user_id: USER,
        project_id: PROJECT,
        valor_dinheiro: 123,
        origem_lancamento: "manual",
      }),
    );
    expect(fake.sync).toHaveBeenCalledOnce();
    expect(fake.hook).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ from: fake.userFrom }),
      [{ source: "movimentacao", id: RECEIPT }],
    );
  });
});
