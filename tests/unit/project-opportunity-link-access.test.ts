import { beforeEach, expect, it, vi } from "vitest";
import { linkProjectOpportunity } from "@/lib/project-allocation.functions";
const f = vi.hoisted(() => ({
  role: "admin",
  contact: "contact-A",
  complete: true,
  rpc: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const b = { middleware: () => b, inputValidator: () => b, handler: (h: unknown) => h };
    return b;
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: f.rpc } }));
vi.mock("@/lib/projects.server", () => ({ listContactOpportunities: f.read }));
function run(extra = {}) {
  const from = (table: string) => {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({
        error: null,
        data:
          table === "app_users"
            ? { role: f.role }
            : { id: "p1", ghl_contact_id: "contact-A", quoted_total_eur: 2700 },
      }),
    };
    return q;
  };
  return (linkProjectOpportunity as unknown as (args: unknown) => Promise<unknown>)({
    context: { userId: "verified-admin", supabase: { from } },
    data: {
      projectId: "p1",
      opportunityId: "opp1",
      keepContract: true,
      idempotencyKey: "test-key-0123456789",
      ...extra,
    },
  });
}
beforeEach(() => {
  vi.stubEnv("PROJECT_ALLOCATION_PERSISTENCE", "enabled");
  f.role = "admin";
  f.rpc.mockReset().mockResolvedValue({ data: { kind: "active", replayed: false }, error: null });
  f.read.mockReset().mockResolvedValue({
    complete: true,
    items: [{ id: "opp1", contactId: "contact-A", status: "won", monetaryValueCents: 90000 }],
  });
});
it("usa identidade autenticada e snapshot CRM; ignora ator/valor enviados pelo cliente", async () => {
  await expect(run({ p_actor: "attacker", monetaryValueCents: 270000 })).resolves.toMatchObject({
    state: "linked",
  });
  expect(f.rpc).toHaveBeenCalledWith(
    "link_project_opportunity",
    expect.objectContaining({ p_actor: "verified-admin", p_value_cents: 90000 }),
  );
});
it("artista não alcança leitura GHL nem serviço privilegiado", async () => {
  f.role = "artist";
  await expect(run()).rejects.toThrow("Acesso negado");
  expect(f.read).not.toHaveBeenCalled();
  expect(f.rpc).not.toHaveBeenCalled();
});
it("flag desligada impede qualquer vínculo", async () => {
  vi.stubEnv("PROJECT_ALLOCATION_PERSISTENCE", "");
  expect(await run()).toEqual({ state: "disabled" });
  expect(f.rpc).not.toHaveBeenCalled();
});
it("leitura incompleta não grava", async () => {
  f.read.mockResolvedValue({ complete: false, items: [] });
  expect(await run()).toEqual({ state: "rejected", reason: "ghl_incomplete" });
  expect(f.rpc).not.toHaveBeenCalled();
});
it("contato errado não grava", async () => {
  f.read.mockResolvedValue({
    complete: true,
    items: [{ id: "opp1", contactId: "other", status: "won", monetaryValueCents: 90000 }],
  });
  expect(await run()).toEqual({ state: "rejected", reason: "contact_mismatch" });
  expect(f.rpc).not.toHaveBeenCalled();
});
it("divergência sem decisão não grava", async () => {
  expect(await run({ keepContract: false })).toEqual({
    state: "rejected",
    reason: "decision_required",
  });
  expect(f.rpc).not.toHaveBeenCalled();
});
