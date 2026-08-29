import { describe, expect, it } from "vitest";

import {
  bookingErrorMessage,
  bookingOutcome,
  contactUpdatePatch,
  overlaps,
  priceServiceLines,
  resolveContactMatch,
  slotIsFree,
  validateBookingInterval,
  type CatalogService,
} from "@/lib/booking-core";

const c = (id: string, phone: string | null, email: string | null) => ({
  id,
  name: id,
  phone,
  email,
});

describe("resolução de contato", () => {
  it("a) contato inexistente → criar", () => {
    const r = resolveContactMatch({ phone: "+32471001234", email: null, candidates: [] });
    expect(r.kind).toBe("create");
  });

  it("b) um contato compatível → reutilizar", () => {
    const r = resolveContactMatch({
      phone: "0032 471 001234",
      email: "cliente@gf.com",
      candidates: [c("x1", "+32471001234", "cliente@gf.com")],
    });
    expect(r).toMatchObject({ kind: "reuse", contact: { id: "x1" } });
  });

  it("c) telefone num contato e e-mail noutro → conflito", () => {
    const r = resolveContactMatch({
      phone: "+32471001234",
      email: "outro@gf.com",
      candidates: [c("x1", "+32471001234", null), c("x2", null, "outro@gf.com")],
    });
    expect(r.kind).toBe("conflict");
    if (r.kind === "conflict") expect(r.candidates.map((x) => x.id)).toEqual(["x1", "x2"]);
  });

  it("c2) vários contatos com o mesmo telefone → conflito", () => {
    const r = resolveContactMatch({
      phone: "+32471001234",
      email: null,
      candidates: [c("x1", "+32471001234", null), c("x2", "0032471001234", null)],
    });
    expect(r.kind).toBe("conflict");
  });

  it("atualiza só campos fornecidos e não vazios", () => {
    const patch = contactUpdatePatch(c("x1", "+32471001234", "a@gf.com"), {
      name: "Novo Nome",
      phone: "0032 471 001234",
      email: "  ",
    });
    expect(patch).toEqual({ name: "Novo Nome" });
  });
});

describe("intervalo e calendário", () => {
  const base = Date.parse("2026-09-01T10:00:00.000Z");

  it("aceita intervalo válido", () => {
    const r = validateBookingInterval(
      new Date(base).toISOString(),
      new Date(base + 60 * 60_000).toISOString(),
      base - 3600_000,
    );
    expect(r.ok).toBe(true);
  });

  it("rejeita fim antes do início e passado", () => {
    expect(
      validateBookingInterval(new Date(base).toISOString(), new Date(base - 1000).toISOString(), base),
    ).toMatchObject({ ok: false, reason: "endBeforeStart" });
    expect(
      validateBookingInterval(
        new Date(base).toISOString(),
        new Date(base + 3600_000).toISOString(),
        base + 48 * 3600_000,
      ),
    ).toMatchObject({ ok: false, reason: "past" });
  });

  it("g) agenda ocupada é detectada por sobreposição", () => {
    expect(overlaps(base, base + 3600_000, base + 1800_000, base + 5400_000)).toBe(true);
    expect(overlaps(base, base + 3600_000, base + 3600_000, base + 7200_000)).toBe(false);
  });

  it("confere free-slot do CRM", () => {
    const iso = new Date(base).toISOString();
    expect(slotIsFree(iso, [iso])).toBe(true);
    expect(slotIsFree(iso, [new Date(base + 3600_000).toISOString()])).toBe(false);
  });
});

describe("preços autoritativos do servidor", () => {
  const catalog = new Map<string, CatalogService>([
    [
      "s1",
      {
        id: "s1",
        name: "Sessão",
        duration_min: 60,
        modality: "presencial",
        price_eur: 200,
        price_on_request: false,
      },
    ],
    [
      "s2",
      {
        id: "s2",
        name: "Projeto grande",
        duration_min: 120,
        modality: "presencial",
        price_eur: 0,
        price_on_request: true,
      },
    ],
  ]);

  it("aplica desconto e override", () => {
    const r = priceServiceLines(
      [
        { id: "s1", discountPct: 10 },
        { id: "s2", discountPct: 0, overridePriceEur: 500 },
      ],
      catalog,
    );
    expect(r.originalEur).toBe(700);
    expect(r.totalEur).toBe(680);
  });

  it("exige valor em serviço sob consulta", () => {
    expect(() => priceServiceLines([{ id: "s2", discountPct: 0 }], catalog)).toThrow();
  });
});

describe("estado da operação e mensagens", () => {
  it("i) evento criado e persistência falhou → reconciliação", () => {
    expect(bookingOutcome({ ghlAppointmentId: "ev1", persisted: false, failed: true })).toEqual({
      step: "event",
      status: "reconciliation_required",
    });
  });

  it("h) persistência concluída → done (reenvio devolve o mesmo)", () => {
    expect(bookingOutcome({ ghlAppointmentId: "ev1", persisted: true, failed: false })).toEqual({
      step: "persisted",
      status: "done",
    });
  });

  it("j) oportunidade criada e evento falhou → failed sem evento", () => {
    expect(bookingOutcome({ ghlAppointmentId: null, persisted: false, failed: true })).toEqual({
      step: "event",
      status: "failed",
    });
  });

  it("mensagem diz a etapa e o que já existe no CRM", () => {
    const msg = bookingErrorMessage({
      step: "persisted",
      detail: "timeout",
      ghlContactId: "c1",
      ghlOpportunityId: "o1",
      ghlAppointmentId: "e1",
    });
    expect(msg).toContain("Gravação local");
    expect(msg).toContain("contato c1");
    expect(msg).toContain("oportunidade o1");
    expect(msg).toContain("evento e1");
  });
});
