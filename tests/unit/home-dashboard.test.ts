import { describe, expect, it } from "vitest";
import {
  MAX_FILA_HOME,
  MAX_PENDENCIAS_VISIVEIS,
  TRACEABILITY_ACTIVATED_AT,
  brusselsTime,
  brusselsToday,
  buildFilaItems,
  filterByScope,
  homeActions,
  resolveArtistScope,
  canSeeFinance,
  canSeeGestao,
  homeRole,
  prioritizePendencias,
  selectNextAppointment,
  stripUnauthorized,
  type HomeDashboard,
  type FilaSource,
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

function fila(p: Partial<FilaSource> & { codigo: string }): FilaSource {
  return {
    codigo: p.codigo,
    clienteNome: p.clienteNome ?? "Cliente",
    status: p.status ?? "aguardando",
    arrivedAt: p.arrivedAt ?? "2026-08-29T11:00:00Z",
    scheduledAt: p.scheduledAt ?? null,
    artistId: p.artistId === undefined ? "a1" : p.artistId,
    artistName: p.artistName ?? "Augusto",
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

/* ---------------- Fase 4 (correção final): escopo fail-closed ---------------- */

describe("escopo por artista (fail-closed)", () => {
  it("artista sem artist_id fica sem escopo (none)", () => {
    expect(resolveArtistScope("artist", null)).toEqual({ kind: "none" });
    expect(resolveArtistScope("artist", "   ")).toEqual({ kind: "none" });
  });

  it("artista com vínculo recebe escopo estrito", () => {
    expect(resolveArtistScope("artist", "a1")).toEqual({ kind: "artist", artistId: "a1" });
  });

  it("admin e recepção veem a operação global", () => {
    expect(resolveArtistScope("admin", null)).toEqual({ kind: "all" });
    expect(resolveArtistScope("recepcao", null)).toEqual({ kind: "all" });
  });

  it("escopo none não devolve nenhuma linha nem próximo cliente", () => {
    const rows = [appt({ id: "x", startAt: "2026-08-29T12:30:00Z", endAt: "2026-08-29T13:30:00Z" })];
    expect(filterByScope(rows, { kind: "none" }, (r) => r.artistId)).toEqual([]);
    expect(
      selectNextAppointment(rows, { nowMs: now, dayEndMs: dayEnd, scope: { kind: "none" } }),
    ).toBeNull();
  });

  it("exclui linhas sem artist_id ou de outro artista", () => {
    const rows = [
      { artistId: null as string | null, tag: "nulo" },
      { artistId: "a2", tag: "outro" },
      { artistId: "a1", tag: "meu" },
    ];
    expect(
      filterByScope(rows, { kind: "artist", artistId: "a1" }, (r) => r.artistId).map((r) => r.tag),
    ).toEqual(["meu"]);
  });

  it("marco de rastreabilidade é o valor real de ativação", () => {
    expect(TRACEABILITY_ACTIVATED_AT).toBe("2026-08-29T14:37:33.000Z");
  });
});

describe("ações por perfil", () => {
  it("artista só vê a Agenda", () => {
    expect(homeActions("artist")).toEqual({
      agenda: true,
      checkin: false,
      pagamento: false,
      financeiro: false,
      gestao: false,
      filaVerTodos: false,
    });
  });

  it("recepção vê Agenda, Check-in e Pagamento, sem Financeiro/Gestão", () => {
    const a = homeActions("recepcao");
    expect([a.agenda, a.checkin, a.pagamento]).toEqual([true, true, true]);
    expect([a.financeiro, a.gestao]).toEqual([false, false]);
  });

  it("admin vê tudo", () => {
    const a = homeActions("admin");
    expect(Object.values(a).every(Boolean)).toBe(true);
  });
});

describe("fila compacta da Home", () => {
  const rows = [
    fila({ codigo: "A1", status: "aguardando", arrivedAt: "2026-08-29T11:00:00Z" }),
    fila({ codigo: "A2", status: "aguardando", arrivedAt: "2026-08-29T11:30:00Z" }),
    fila({ codigo: "A3", status: "em_atendimento", arrivedAt: "2026-08-29T11:45:00Z" }),
    fila({ codigo: "A4", status: "aguardando", arrivedAt: "2026-08-29T11:50:00Z" }),
    fila({ codigo: "A5", status: "aguardando", arrivedAt: "2026-08-29T11:55:00Z" }),
    fila({ codigo: "A6", status: "concluido", arrivedAt: "2026-08-29T10:00:00Z" }),
  ];

  it("em atendimento primeiro, ativos apenas, no máximo 4", () => {
    const out = buildFilaItems(rows, { kind: "all" }, now);
    expect(out.length).toBe(MAX_FILA_HOME);
    expect(out[0]!.codigo).toBe("A3");
    expect(out.map((i) => i.codigo)).not.toContain("A6");
  });

  it("calcula espera e hora no fuso do estúdio", () => {
    const out = buildFilaItems([rows[0]!], { kind: "all" }, now);
    expect(out[0]!.timeLabel).toBe("13:00");
    expect(out[0]!.esperaMin).toBe(60);
  });

  it("artista recebe apenas as próprias linhas", () => {
    const mixed = [
      fila({ codigo: "X", artistId: "a2", arrivedAt: "2026-08-29T11:00:00Z" }),
      fila({ codigo: "Y", artistId: null, arrivedAt: "2026-08-29T11:10:00Z" }),
      fila({ codigo: "Z", artistId: "a1", arrivedAt: "2026-08-29T11:20:00Z" }),
    ];
    const out = buildFilaItems(mixed, { kind: "artist", artistId: "a1" }, now);
    expect(out.map((i) => i.codigo)).toEqual(["Z"]);
  });

  it("artista sem vínculo recebe fila vazia", () => {
    expect(buildFilaItems(rows, { kind: "none" }, now)).toEqual([]);
  });
});
