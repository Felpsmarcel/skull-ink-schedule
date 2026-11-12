import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  WizardReviewView,
  type WizardReviewDraft,
} from "@/components/appointment-wizard/wizard-review-view";
import { draftValuesComplete, totalFinalEur, totalOriginalEur } from "@/stores/appointment-draft";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/services", () => ({
  formatPrice: (value: number) => `EUR[${value}]`,
  modalityLabel: () => "Presencial",
}));

function review({
  onRequest = true,
  price = 600,
  override = null,
  discount = 0,
  extraKnownLine = false,
}: {
  onRequest?: boolean;
  price?: number;
  override?: number | null;
  discount?: number;
  extraKnownLine?: boolean;
} = {}) {
  const service = {
    id: "service",
    name: "Sessão fictícia",
    category: "Tattoo",
    duration_min: 180,
    modality: "presencial" as const,
    price_eur: price,
    price_max_eur: null,
    description: null,
    description_short: null,
    sort_order: 0,
    active: true,
    price_on_request: onRequest,
  };
  const draft: WizardReviewDraft = {
    contact: { id: "contact", contactName: "Cliente fictício" },
    calendarId: "calendar",
    startISO: "2026-11-16T10:00:00Z",
    sessionCount: 3,
    extraStarts: ["2026-11-23T10:00:00Z", "2026-12-07T10:00:00Z"],
    services: [
      { service, discountPct: discount, overridePriceEur: override },
      ...(extraKnownLine
        ? [
            {
              service: { ...service, id: "known-service", price_eur: 200, price_on_request: false },
              discountPct: 0,
              overridePriceEur: null,
            },
          ]
        : []),
    ],
    notes: "",
    sellerId: null,
    depositEur: 0,
    idempotencyKey: "fixture",
    project: {
      decision: "new",
      reuseProjectId: null,
      reuseOpportunityId: null,
      projectType: "cover_up",
      bodyPart: "",
      description: "Projeto fictício",
    },
    setSeller: vi.fn(),
    setOverridePrice: vi.fn(),
    setDiscount: vi.fn(),
    removeService: vi.fn(),
    setNotes: vi.fn(),
    setDeposit: vi.fn(),
  };
  const final = totalFinalEur(draft);
  const original = totalOriginalEur(draft);
  const complete = draftValuesComplete(draft);
  const html = renderToStaticMarkup(
    createElement(WizardReviewView, {
      draft,
      staffName: "Artista fictício",
      sellers: [],
      startLabel: "16 nov.",
      summary: {
        original,
        final,
        hasDiscount: final < original,
        deposit: 0,
        balance: final,
        valuesComplete: complete,
      },
      canFinalize: complete,
      saving: false,
      onFinalize: vi.fn(),
    }),
  );
  return { html, text: html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ") };
}

describe("wizard review amounts are not known until every service value is supplied", () => {
  it("does not show empty requested prices as zero for the session, project, session rows or CTA", () => {
    const { html, text } = review();
    expect(text).toContain("Total por sessãoValor não informado");
    expect(text).toContain("Total do projeto · 3 sessõesValor não informado");
    expect(text.match(/A definir/g)).toHaveLength(3);
    expect(text).not.toContain("EUR[0]");
    expect(text).toContain("Confirmar 3 sessões· Valor não informado");
    expect(html.slice(html.indexOf("<footer"))).toContain('disabled=""');
  });

  it("does not present the known portion as the complete contract when another service lacks a price", () => {
    const { text } = review({ extraKnownLine: true });
    expect(text).toContain("EUR[200]"); // The independently priced service remains visible.
    expect(text).toContain("Total por sessãoValor não informado");
    expect(text).toContain("Total do projeto · 3 sessõesValor não informado");
    expect(text).not.toContain("EUR[600]");
  });

  it.each([
    { onRequest: false, price: 0 },
    { onRequest: true, override: 600, discount: 100 },
  ])("preserves an explicit valid zero: %j", (options) => {
    const { html, text } = review(options);
    expect(text).toContain("Total por sessão");
    expect(text).toContain("Total do projeto · 3 sessõesEUR[0]");
    expect(text.match(/EUR\[0\]/g)?.length).toBeGreaterThanOrEqual(5);
    expect(text).not.toContain("Valor não informado");
    expect(text).not.toContain("A definir");
    expect(html.slice(html.indexOf("<footer"))).not.toContain('disabled=""');
  });
});
