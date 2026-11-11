import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProjectDetail } from "@/lib/projects.functions";

const fake = vi.hoisted(() => ({
  middleware: {},
  role: "admin" as string | null,
  artistId: "artist-1" as string | null,
  queries: [] as string[],
  filters: [] as [string, string, unknown][],
  error: false,
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: fake.middleware,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let middleware: unknown[] = [];
    const builder = {
      middleware: (items: unknown[]) => {
        middleware = items;
        return builder;
      },
      inputValidator: () => builder,
      handler: (handler: (args: unknown) => unknown) => ({
        run: (context: unknown, data: unknown) => {
          expect(middleware).toEqual([fake.middleware]);
          return handler({ context, data });
        },
      }),
    };
    return builder;
  },
}));

const from = (table: string) => {
  fake.queries.push(table);
  const filters: Record<string, unknown> = {};
  const result = () => {
    if (table === "app_users")
      return {
        data: fake.role ? { role: fake.role, artist_id: fake.artistId } : null,
        error: null,
      };
    if (fake.error) return { data: null, error: { message: "synthetic private read failure" } };
    if (table === "tattoo_projects")
      return {
        data:
          filters.artist_id && filters.artist_id !== "artist-1"
            ? null
            : {
                id: "project-1",
                title: "Projeto sintético",
                description: null,
                status: "scheduled",
                body_part: null,
                artist_id: "artist-1",
                quoted_total_eur: 2700,
                deposit_eur: 450,
                ghl_contact_id: "contact-1",
                contacts: { name: "Cliente sintético", phone: null, email: null },
                artists: { name: "Artista sintético" },
              },
        error: null,
      };
    if (table === "appointments")
      return {
        data: [{ id: "appt-1", start_at: "2026-12-05T09:00:00Z", status: "confirmed" }],
        error: null,
      };
    return { data: [{ total: 450, tipo_movimento: "sinal" }], error: null };
  };
  const q = {
    select: () => q,
    eq: (key: string, value: unknown) => {
      filters[key] = value;
      fake.filters.push([table, key, value]);
      return q;
    },
    is: () => q,
    order: () => q,
    maybeSingle: async () => result(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
  };
  return q;
};
const run = () =>
  (
    getProjectDetail as unknown as { run: (context: unknown, data: unknown) => Promise<unknown> }
  ).run({ userId: "authenticated-id", supabase: { from } }, { projectId: "project-1" });
beforeEach(() => {
  fake.role = "admin";
  fake.artistId = "artist-1";
  fake.queries = [];
  fake.filters = [];
  fake.error = false;
});

describe("contrato existente de detalhe — sem ampliar acesso", () => {
  it.each(["seller", null, "unknown"])("nega %s antes de consultar projetos", async (role) => {
    fake.role = role;
    await expect(run()).rejects.toThrow("Acesso negado");
    expect(fake.queries).toEqual(["app_users"]);
  });
  it("nega artista sem vínculo", async () => {
    fake.role = "artist";
    fake.artistId = null;
    await expect(run()).rejects.toThrow("Acesso negado");
    expect(fake.queries).toEqual(["app_users"]);
  });
  it("artista de outro projeto recebe null sem sessões nem financeiro", async () => {
    fake.role = "artist";
    fake.artistId = "artist-2";
    await expect(run()).resolves.toBeNull();
    expect(fake.filters).toContainEqual(["tattoo_projects", "artist_id", "artist-2"]);
    expect(fake.queries).not.toContain("movimentacoes");
  });
  it("artista próprio mantém parcela autorizada sem bruto", async () => {
    fake.role = "artist";
    const result = (await run()) as { finance: Record<string, number | null> };
    expect(result.finance).toEqual({
      quotedCents: null,
      depositCents: null,
      receivedCents: null,
      balanceCents: null,
      artistShareCents: 15750,
    });
  });
  it("admin mantém os valores existentes", async () => {
    const result = (await run()) as { finance: Record<string, number | null> };
    expect(result.finance.quotedCents).toBe(270000);
    expect(result.finance.balanceCents).toBe(225000);
  });
  it("falha não retorna nome nem agregado zero", async () => {
    fake.error = true;
    await expect(run()).rejects.toThrow("Não foi possível carregar o projeto");
  });
});
