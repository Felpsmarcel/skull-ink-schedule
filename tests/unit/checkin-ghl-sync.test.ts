import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncCheckinToGhl, type CheckinSyncInput } from "@/lib/checkin-ghl.server";
const fake = vi.hoisted(() => ({ from: vi.fn(), fetch: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: fake.from } }));

const input: CheckinSyncInput = {
  checkinId: "synthetic-checkin",
  clienteNome: "Pessoa Fictícia",
  clienteTelefone: null,
  ghlContactId: "explicit-contact",
  ghlAppointmentId: "explicit-selected-event",
  consentimento: false,
  codigoAtendimento: "DEMO-01",
  qrUrl: "https://invalid.example/synthetic-only",
  arrivedAtISO: "2026-11-12T09:00:00Z",
};
function response(ok = true, body: unknown = {}) {
  return { ok, status: ok ? 200 : 500, text: async () => JSON.stringify(body) };
}
beforeEach(() => {
  vi.stubEnv("GHL_TOKEN", "synthetic-token-never-real");
  fake.fetch.mockReset().mockImplementation(async () => response());
  vi.stubGlobal("fetch", fake.fetch);
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => ({ data: { value: { id: "explicit-workflow" } }, error: null }),
  };
  fake.from.mockReset().mockReturnValue(q);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("check-in CRM sync — mocked only", () => {
  it("does not look up or trigger the communication workflow without consent", async () => {
    const result = await syncCheckinToGhl(input);
    expect(result.workflowTriggered).toBe(false);
    expect(fake.from).not.toHaveBeenCalled();
    expect(fake.fetch.mock.calls.some(([url]) => String(url).includes("/workflow/"))).toBe(false);
    expect(result.steps).toContain("workflow: não acionado; sem consentimento");
  });
  it("triggers only the configured workflow with explicit consent, without claiming delivery", async () => {
    const result = await syncCheckinToGhl({ ...input, consentimento: true });
    const calls = fake.fetch.mock.calls.filter(([url]) => String(url).includes("/workflow/"));
    expect(calls).toHaveLength(1);
    expect(String(calls[0][0])).toContain("/contacts/explicit-contact/workflow/explicit-workflow");
    expect(result.workflowTriggered).toBe(true);
    expect(result.steps).toContain("workflow: solicitação aceita; entrega não comprovada");
    expect(result).not.toHaveProperty("notificado_em");
  });
  it("preserves the explicitly selected event and never fetches the first appointment or opportunity", async () => {
    fake.fetch.mockImplementation(async (url) => {
      if (String(url).includes("/appointments") || String(url).includes("/opportunities")) {
        return response(true, {
          events: [{ id: "wrong-first-event" }],
          opportunities: [{ id: "wrong-first-opportunity" }],
        });
      }
      return response();
    });
    const result = await syncCheckinToGhl(input);
    expect(result.ghlAppointmentId).toBe("explicit-selected-event");
    expect(result.ghlOpportunityId).toBeUndefined();
    expect(
      fake.fetch.mock.calls.some(([url]) => /appointments|opportunities/.test(String(url))),
    ).toBe(false);
  });
  it("does not invent an event or opportunity for an unlinked arrival", async () => {
    const result = await syncCheckinToGhl({ ...input, ghlAppointmentId: null });
    expect(result.ghlAppointmentId).toBeUndefined();
    expect(result.ghlOpportunityId).toBeUndefined();
  });
  it("does not label failed workflow or contact field updates as synced", async () => {
    fake.fetch.mockImplementation(async (url) => response(!String(url).includes("/workflow/")));
    const failedWorkflow = await syncCheckinToGhl({ ...input, consentimento: true });
    expect(failedWorkflow.ok).toBe(false);
    expect(failedWorkflow.workflowTriggered).toBe(false);
    fake.fetch.mockImplementation(async (_url, request) => response(request.method !== "PUT"));
    expect((await syncCheckinToGhl(input)).ok).toBe(false);
  });
  it("keeps an unlinked arrival local instead of searching or creating a CRM contact", async () => {
    const result = await syncCheckinToGhl({
      ...input,
      ghlContactId: null,
      clienteTelefone: "+32000000000",
      consentimento: true,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Chegada local preservada");
    expect(fake.fetch).not.toHaveBeenCalled();
    expect(fake.from).not.toHaveBeenCalled();
    expect(result.ghlContactId).toBeUndefined();
  });
  it("fails explicitly when workflow configuration cannot be read", async () => {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data: null, error: new Error("unavailable") }),
    };
    fake.from.mockReturnValue(q);
    const result = await syncCheckinToGhl({ ...input, consentimento: true });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("configuração");
    expect(fake.fetch.mock.calls.some(([url]) => String(url).includes("/workflow/"))).toBe(false);
  });
  it("does not perform any external request when its server token is unavailable", async () => {
    vi.stubEnv("GHL_TOKEN", "");
    expect((await syncCheckinToGhl(input)).ok).toBe(false);
    expect(fake.fetch).not.toHaveBeenCalled();
  });
});
