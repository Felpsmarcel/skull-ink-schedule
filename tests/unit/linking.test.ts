import { describe, expect, it } from "vitest";

import {
  appointmentLinkStatus,
  normalizeEmail,
  normalizePhone,
  samePhone,
  validatePaymentLink,
} from "@/lib/linking";

describe("normalização de contacto", () => {
  it("limpa caracteres invisíveis e converte 00 em +", () => {
    expect(normalizePhone("\u202a00 32 471 00 12 34\u202c")).toBe("+3247100 1234".replace(" ", ""));
  });

  it("casa telefones com formatações diferentes", () => {
    expect(samePhone("+32 471 001234", "0032471001234")).toBe(true);
    expect(samePhone("+32471001234", "+32471009999")).toBe(false);
  });

  it("valida e-mail", () => {
    expect(normalizeEmail(" Cliente@GF.com ")).toBe("cliente@gf.com");
    expect(normalizeEmail("nope")).toBeNull();
  });
});

describe("badges de auditoria do agendamento", () => {
  const base = {
    projectId: "p1",
    ghlOpportunityId: "o1",
    ghlAppointmentId: "a1",
    hasPayment: true,
  };

  it("a) contacto novo + novo projeto totalmente ligado", () => {
    expect(appointmentLinkStatus(base)).toBe("vinculado");
  });

  it("g) registo histórico com campos nullable continua visível como incompleto", () => {
    expect(
      appointmentLinkStatus({ ...base, projectId: null, ghlOpportunityId: null }),
    ).toBe("vinculo_incompleto");
  });

  it("sem oportunidade", () => {
    expect(appointmentLinkStatus({ ...base, ghlOpportunityId: null })).toBe("sem_oportunidade");
  });

  it("e) sessão sem pagamento vinculado", () => {
    expect(appointmentLinkStatus({ ...base, hasPayment: false })).toBe("sem_pagamento");
  });
});

describe("validação de vínculo do pagamento", () => {
  it("d) sinal vinculado ao agendamento é aceite", () => {
    expect(
      validatePaymentLink({ tipo: "sinal", appointmentId: "a1", projectId: "p1" }).ok,
    ).toBe(true);
  });

  it("sessão sem vínculo e sem justificativa é rejeitada", () => {
    const r = validatePaymentLink({ tipo: "sessao" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missingProject");
  });

  it("justificativa curta é rejeitada", () => {
    const r = validatePaymentLink({ tipo: "sessao", semVinculoJustificativa: "curto" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missingJustification");
  });

  it("justificativa explícita permite lançar sem vínculo", () => {
    expect(
      validatePaymentLink({
        tipo: "sinal",
        semVinculoJustificativa: "Cliente pagou sinal por transferência antes de agendar.",
      }).ok,
    ).toBe(true);
  });

  it("produto/saldo/estorno não exigem vínculo", () => {
    for (const tipo of ["produto", "saldo", "estorno"]) {
      expect(validatePaymentLink({ tipo }).ok).toBe(true);
    }
  });
});
