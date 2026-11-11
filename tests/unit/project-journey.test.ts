import { describe, expect, it } from "vitest";
import { projectJourney, projectContinuity, formatProjectDate } from "@/lib/project-journey-core";
import type { AppointmentLinkInfo, ProjectDetail } from "@/lib/projects.functions";

const link: AppointmentLinkInfo = {
  appointmentId: "appt-1",
  projectId: "project-1",
  ghlAppointmentId: "ghl-appt-1",
  ghlOpportunityId: "opp-1",
  ghlContactId: "contact-1",
  hasPayment: false,
  status: "sem_pagamento",
};
const fixture = (count: number): ProjectDetail => ({
  role: "admin",
  id: "project-1",
  title: "Projeto sintético",
  description: "Consulta original",
  status: "scheduled",
  bodyPart: null,
  artistId: "artist-1",
  artistName: "Artista sintético",
  client: { name: "Cliente sintético", phone: null, email: null, ghlContactId: "contact-1" },
  sessions: Array.from({ length: count }, (_, i) => ({
    id: `appt-${i + 1}`,
    startAt: `2026-12-${String(5 + i).padStart(2, "0")}T09:00:00Z`,
    status: "confirmed",
    index: i + 1,
    total: count,
  })),
  progress: { total: count, done: 0, nextStartAt: count ? "2026-12-05T09:00:00Z" : null },
  finance: {
    quotedCents: 270000,
    depositCents: 45000,
    receivedCents: 45000,
    balanceCents: 225000,
    artistShareCents: 15750,
  },
});

describe("jornada de leitura por IDs explícitos", () => {
  it("zero registros não comprova o vínculo do compromisso", () => {
    expect(projectJourney(link, fixture(0))).toEqual({ state: "unverified", project: null });
  });
  it.each([1, 3])("preserva %i registros sem inventar sessões ou duplicar valores", (count) => {
    const p = fixture(count);
    const result = projectJourney(link, p);
    expect(result.state).toBe("confirmed");
    expect(result.project?.sessions).toHaveLength(count);
    expect(result.project?.finance.quotedCents).toBe(270000);
    expect(result.project?.finance.balanceCents).toBe(225000);
    expect(result.project?.description).toBe("Consulta original");
    expect(result.project).not.toHaveProperty("appointmentType");
    expect(result.project).not.toHaveProperty("commercialStatus");
  });
  it("vínculo sem oportunidade é incompleto, independentemente de pagamento", () => {
    expect(
      projectJourney({ ...link, ghlOpportunityId: null, hasPayment: true }, fixture(1)).state,
    ).toBe("incomplete");
  });
  it("não seleciona outra oportunidade/projeto do mesmo contato", () => {
    expect(projectJourney(link, { ...fixture(1), id: "project-2" }).project).toBeNull();
    expect(projectJourney({ ...link, projectId: null }, fixture(1)).state).toBe("absent");
  });
  it("projeto negado ou indisponível não revela contexto", () => {
    expect(projectJourney(link, null)).toEqual({ state: "unverified", project: null });
  });
  it("ausência de próxima data não conclui nem abandona projeto", () => {
    expect(projectContinuity(null)).toEqual({ state: "verify", startAt: null });
    expect(projectContinuity("inválida")).toEqual({ state: "verify", startAt: null });
    expect(projectContinuity("2026-12-05T09:00:00Z")).toEqual({
      state: "scheduled",
      startAt: "2026-12-05T09:00:00Z",
    });
  });
  it("datas reais respeitam o salto DST de Bruxelas", () => {
    expect(formatProjectDate("2026-03-29T00:30:00Z")).toContain("01:30");
    expect(formatProjectDate("2026-03-29T01:30:00Z")).toContain("03:30");
  });
});
