import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProjectFinance } from "@/lib/projects.functions";

// Fixtures sintéticas: dois artistas fictícios, admin e usuário sem vínculo.
const fake = vi.hoisted(() => ({
  middleware: {},
  me: null as { role: string; artist_id: string | null } | null,
  project: null as Record<string, unknown> | null,
  queries: [] as string[],
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: fake.middleware }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let mw: unknown[] = [];
    const b = {
      middleware: (m: unknown[]) => ((mw = m), b),
      inputValidator: () => b,
      handler: (h: (a: unknown) => unknown) => ({
        run: (context: unknown, data: unknown) => {
          expect(mw).toEqual([fake.middleware]);
          return h({ context, data });
        },
      }),
    };
    return b;
  },
}));

const from = (table: string) => {
  fake.queries.push(table);
  const result = () => {
    if (table === "app_users") return { data: fake.me, error: null };
    if (table === "tattoo_projects") return { data: fake.project, error: null };
    return { data: [{ total: 450, tipo_movimento: "sinal" }], error: null };
  };
  const q = {
    select: () => q,
    eq: () => q,
    is: () => q,
    maybeSingle: async () => result(),
    then: (r: (v: unknown) => unknown) => Promise.resolve(result()).then(r),
  };
  return q;
};
const run = (projectId = "00000000-0000-4000-8000-000000000001") =>
  (getProjectFinance as unknown as { run: (c: unknown, d: unknown) => Promise<unknown> }).run(
    { userId: "auth-user", supabase: { from } },
    { projectId, artistId: "artist-A" }, // artistId do cliente é ignorado
  );

beforeEach(() => {
  fake.me = { role: "admin", artist_id: null };
  fake.project = { id: "p1", title: "Projeto sintético", quoted_total_eur: 2700, deposit_eur: 0, artist_id: "artist-A" };
  fake.queries = [];
});

describe("getProjectFinance — identidade verificada antes da leitura", () => {
  it("admin mantém o acesso atual", async () => {
    await expect(run()).resolves.toMatchObject({ quotedTotalEur: 2700, recebidoEur: 450, saldoEur: 2250 });
    expect(fake.queries).toEqual(["app_users", "tattoo_projects", "movimentacoes"]);
  });
  it.each([
    ["usuário sem vínculo", null],
    ["vendedor", { role: "seller", artist_id: null }],
    ["artista sem artistId", { role: "artist", artist_id: null }],
    ["artista do próprio projeto (bruto é só admin)", { role: "artist", artist_id: "artist-A" }],
    ["artista de projeto alheio", { role: "artist", artist_id: "artist-B" }],
  ])("nega %s sem consultar projeto nem movimentações", async (_l, me) => {
    fake.me = me;
    await expect(run()).rejects.toThrow("Acesso negado");
    expect(fake.queries).toEqual(["app_users"]);
  });
  it("projeto inexistente para admin mantém a convenção existente", async () => {
    fake.project = null;
    await expect(run()).rejects.toThrow("Projeto não encontrado");
    expect(fake.queries).not.toContain("movimentacoes");
  });
  it("artista não distingue projeto inexistente de alheio", async () => {
    fake.me = { role: "artist", artist_id: "artist-B" };
    fake.project = null;
    await expect(run()).rejects.toThrow("Acesso negado");
  });
});
