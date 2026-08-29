import { describe, expect, it } from "vitest";
import {
  MAX_PENDENCIAS_VISIVEIS,
  TRACEABILITY_ACTIVATED_AT,
  brusselsTime,
  brusselsToday,
  canSeeFinance,
  canSeeGestao,
  homeRole,
  prioritizePendencias,
  selectNextAppointment,
  stripUnauthorized,
  type HomeDashboard,
  type NextCandidate,
  type Pendencia,
} from "@/lib/home-dashboard";

const now = Date.parse("2026-08-29T12:00:00.000Z");
const dayEnd = Date.parse("2026-08-29T21:59:59.999Z"); // 23:59:59 Brussels

function appt(p: Partial<NextCandidate> & { startAt: string; endAt: string }): NextCandidate {
  return {
    id: p.id ?? p.startAt,
    ghlAppointmentId: p.ghlAppointmentId ?? "ghl-1",
    status: p.status ?? "confirmed",
    clientName: p.clientName ?? "Cliente",
    artistId: p.artistId ?? "a1",
    artistName: p.artistName ?? "Augusto",
    startAt: p.startAt,
    endAt: p.endAt,
  };
}

describe("selectNextAppointment", () => {
  const list = [
    appt({ id: "past", startAt: "2026-08-29T08:00:00Z", endAt: "2026-08-29T09:00:00Z" }),
    appt({ id: "ongoing", startAt: "2026-08-29T11:30:00Z", endAt: "2026-08-29T13:00:00Z" }),
    appt({ id: "later", startAt: "2026-08-29T15:00:00Z", endAt: "2026-08-29T16:00:00Z" }),
    appt({ id: "tomorrow", startAt: "2026-08-30T09:00:00Z", endAt: "2026-08-30T10:00:00Z" }),
  ];

  it("escolhe o agendamento em curso / mais próximo do dia", () => {
    expect(selectNextAppointment(list, { nowMs: now, dayEndMs: dayEnd })?.id).toBe("ongoing");
  });

  it("ignora cancelados e no-show", () => {
    const cancelled = [
      appt({ id: "ongoing", status: "cancelled", startAt: "2026-08-29T11:30:00Z", endAt: "2026-08-29T13:00:00Z" }),
      appt({ id: "later", startAt: "2026-08-29T15:00:00Z", endAt: "2026-08-29T16:00:00Z" }),
    ];
    expect(selectNextAppointment(cancelled, { nowMs: now, dayEndMs: dayEnd })?.id).toBe("later");
  });

  it("não vaza outro dia nem passado", () => {
    const onlyOther = [list[0]!, list[3]!];
    expect(selectNextAppointment(onlyOther, { nowMs: now, dayEndMs: dayEnd })).toBeNull();
  });

  it("restringe ao artista quando informado", () => {
    const mixed = [
      appt({ id: "outro", artistId: "a2", startAt: "2026-08-29T12:30:00Z", endAt: "2026-08-29T13:30:00Z" }),
      appt({ id: "meu", artistId: "a1", startAt: "2026-08-29T14:00:00Z", endAt: "2026-08-29T15:00:00Z" }),
    ];
    expect(selectNextAppointment(mixed, { nowMs: now, dayEndMs: dayEnd, artistId: "a1" })?.id).toBe("meu");
  });

  it("vazio quando não há nada elegível", () => {
    expect(selectNextAppointment([], { nowMs: now, dayEndMs: dayEnd })).toBeNull();
  });
});

describe("timezone Europe/Brussels", () => {
  it("formata a hora no fuso do estúdio (UTC+2 no verão)", () => {
    expect(brusselsTime("2026-08-29T12:00:00Z")).toBe("14:00");
  });

  it("formata a data de hoje no fuso do estúdio", () => {
    // 23:30 UTC de 29/08 já é 30/08 em Bruxelas
    expect(brusselsToday(new Date("2026-08-29T23:30:00Z"))).toContain("30");
  });
});

describe("pendências administrativas", () => {
  const base: Pendencia[] = [
    { kind: "passados_confirmados", label: "d", count: 12, severity: "atencao", to: "/x" },
    { kind: "sessoes_sem_pagamento", label: "c", count: 3, severity: "atencao", to: "/x" },
    { kind: "vinculos", label: "b", count: 2, severity: "critica", to: "/x" },
    { kind: "reconciliation", label: "a", count: 1, severity: "critica", to: "/x" },
  ];

  it("críticas primeiro, no máximo 3 visíveis", () => {
    const out = prioritizePendencias(base);
    expect(out.length).toBe(MAX_PENDENCIAS_VISIVEIS);
    expect(out.map((p) => p.kind)).toEqual([
      "reconciliation",
      "vinculos",
      "sessoes_sem_pagamento",
    ]);
  });

  it("descarta contagens zeradas", () => {
    const out = prioritizePendencias([
      { kind: "reconciliation", label: "a", count: 0, severity: "critica", to: "/x" },
      { kind: "vinculos", label: "b", count: 5, severity: "critica", to: "/x" },
    ]);
    expect(out.map((p) => p.kind)).toEqual(["vinculos"]);
  });

  it("marco de rastreabilidade é uma data ISO documentada", () => {
    expect(Number.isNaN(Date.parse(TRACEABILITY_ACTIVATED_AT))).toBe(false);
  });
});

describe("filtragem por perfil", () => {
  it("mapeia papéis do app", () => {
    expect(homeRole("admin")).toBe("admin");
    expect(homeRole("artist")).toBe("artist");
    expect(homeRole("seller")).toBe("recepcao");
    expect(homeRole(null)).toBe("recepcao");
  });

  it("apenas admin vê financeiro e gestão", () => {
    expect(canSeeFinance("admin")).toBe(true);
    expect(canSeeFinance("recepcao")).toBe(false);
    expect(canSeeGestao("artist")).toBe(false);
  });

  it("remove o bloco de gestão do payload de perfis sem autorização", () => {
    const dash: HomeDashboard = {
      role: "artist",
      dateLabel: "x",
      updatedAtISO: new Date(now).toISOString(),
      next: null,
      fila: { aguardando: 0, emAtendimento: 0 },
      gestao: {
        recebidoHoje: 900,
        pendencias: [],
        vinculosHistorico: 10,
        vinculosNovos: 1,
        marcoRastreabilidade: TRACEABILITY_ACTIVATED_AT,
        degraded: false,
      },
    };
    const out = stripUnauthorized(dash);
    expect("gestao" in out).toBe(false);
    expect(JSON.stringify(out)).not.toContain("900");
  });

  it("mantém gestão para admin (falha parcial sinalizada, operação intacta)", () => {
    const dash: HomeDashboard = {
      role: "admin",
      dateLabel: "x",
      updatedAtISO: new Date(now).toISOString(),
      next: null,
      fila: { aguardando: 2, emAtendimento: 1 },
      gestao: {
        recebidoHoje: 0,
        pendencias: [],
        vinculosHistorico: 0,
        vinculosNovos: 0,
        marcoRastreabilidade: TRACEABILITY_ACTIVATED_AT,
        degraded: true,
      },
    };
    const out = stripUnauthorized(dash);
    expect(out.gestao?.degraded).toBe(true);
    expect(out.fila.aguardando).toBe(2);
  });
});
