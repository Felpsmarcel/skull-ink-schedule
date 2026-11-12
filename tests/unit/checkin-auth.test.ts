import { describe, expect, it, vi } from "vitest";
import {
  searchTotemClientes,
  validateTotemTelefone,
  confirmarChegada,
} from "@/lib/checkin.functions";
const fake = vi.hoisted(() => ({ middleware: {}, admin: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: fake.middleware,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    fake.admin();
    throw new Error("Privileged database must not be reached");
  },
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let middleware: unknown[] = [];
    const b = {
      middleware: (m: unknown[]) => {
        middleware = m;
        return b;
      },
      inputValidator: () => b,
      handler: (fn: (args: unknown) => unknown) => ({
        run: (context: unknown, data: unknown) => {
          expect(middleware).toEqual([fake.middleware]);
          return fn({ context, data });
        },
      }),
    };
    return b;
  },
}));
describe("check-in privileged entrypoints", () => {
  it.each([searchTotemClientes, validateTotemTelefone, confirmarChegada])(
    "denies an artist before privileged database access",
    async (fn) => {
      fake.admin.mockClear();
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: { role: "artist" }, error: null }),
      };
      await expect(
        (fn as unknown as { run: (context: unknown, data: unknown) => Promise<unknown> }).run(
          { userId: "artist-user", supabase: { from: () => q } },
          { query: "cliente", nome: "Pessoa" },
        ),
      ).rejects.toThrow("recepção");
      expect(fake.admin).not.toHaveBeenCalled();
    },
  );
});
