import { describe, it, expect } from "vitest";
import { projectTotalEur, allSessionsScheduled, type AppointmentDraft } from "@/stores/appointment-draft";

const base = {
  contact: null, calendarId: "c", startISO: "2026-11-01T10:00:00Z", notes: "", sellerId: null,
  depositEur: 200, idempotencyKey: "k",
  project: { decision: "new", reuseProjectId: null, reuseOpportunityId: null, projectType: "new_tattoo", bodyPart: "", description: "" },
  services: [{ service: { id: "s", name: "Sessão", price_eur: 900, duration_min: 240, price_on_request: false }, discountPct: 0, overridePriceEur: null }],
} as unknown as AppointmentDraft;

describe("projeto multi-sessões", () => {
  it("3 sessões de 900 € somam 2.700 € (sinal não reduz o total)", () => {
    expect(projectTotalEur({ ...base, sessionCount: 3, extraStarts: ["a", "b"] })).toBe(2700);
  });
  it("sessão única mantém o valor da sessão", () => {
    expect(projectTotalEur({ ...base, sessionCount: 1, extraStarts: [] })).toBe(900);
  });
  it("exige data em todas as sessões", () => {
    expect(allSessionsScheduled({ ...base, sessionCount: 3, extraStarts: ["a", null] })).toBe(false);
  });
});
