import { describe, expect, it } from "vitest";
import {
  fingerprint,
  healthLevel,
  inferSeverity,
  normalizeSource,
  prioritizeIncidents,
  sanitizeContext,
  sanitizeMessage,
  type Incident,
} from "@/lib/observability";

function incident(over: Partial<Incident>): Incident {
  return {
    id: over.id ?? "1",
    fingerprint: over.fingerprint ?? "f",
    source: over.source ?? "app",
    kind: over.kind ?? "test",
    severity: over.severity ?? "media",
    status: over.status ?? "open",
    message: over.message ?? "erro",
    safeContext: over.safeContext ?? {},
    occurrences: over.occurrences ?? 1,
    firstSeenAt: over.firstSeenAt ?? "2026-08-29T10:00:00.000Z",
    lastSeenAt: over.lastSeenAt ?? "2026-08-29T10:00:00.000Z",
    acknowledgedAt: over.acknowledgedAt ?? null,
  };
}

describe("sanitização", () => {
  it("remove PII de mensagens", () => {
    const msg = sanitizeMessage(
      "falha para joao@x.com tel +351 912 345 678 id 3841eeda-0557-42cb-9fd7-21f335cc1c11",
    );
    expect(msg).not.toContain("joao@x.com");
    expect(msg).toContain("[email]");
    expect(msg).toContain("[tel]");
    expect(msg).toContain("[id]");
  });

  it("mantém apenas chaves da allow-list", () => {
    const ctx = sanitizeContext({
      httpStatus: 401,
      step: "contact",
      clientName: "João",
      email: "a@b.c",
      phone: "+351912345678",
      payload: { a: 1 },
    });
    expect(ctx).toEqual({ httpStatus: 401, step: "contact" });
  });

  it("ignora entradas inválidas", () => {
    expect(sanitizeContext(null)).toEqual({});
    expect(sanitizeContext(["a"])).toEqual({});
  });
});

describe("fingerprint e severidade", () => {
  it("agrupa ocorrências equivalentes", () => {
    const a = fingerprint("ghl", "sync", "GHL 401 unauthorized for contact 12345");
    const b = fingerprint("ghl", "sync", "GHL 401 unauthorized for contact 99999");
    expect(a).toBe(b);
  });

  it("separa origens diferentes", () => {
    expect(fingerprint("ghl", "sync", "timeout")).not.toBe(
      fingerprint("supabase", "sync", "timeout"),
    );
  });

  it("classifica 401 como crítica e timeout como alta", () => {
    expect(inferSeverity("ghl", "unauthorized", 401)).toBe("critica");
    expect(inferSeverity("ghl", "fetch failed", null)).toBe("alta");
  });

  it("normaliza origens desconhecidas", () => {
    expect(normalizeSource("qualquer")).toBe("app");
    expect(normalizeSource("GHL")).toBe("ghl");
  });
});

describe("prioridade e semáforo", () => {
  it("abertos e críticos primeiro, resolvidos fora", () => {
    const list = [
      incident({ id: "res", status: "resolved", severity: "critica" }),
      incident({ id: "ack", status: "acknowledged", severity: "critica" }),
      incident({ id: "media", severity: "media" }),
      incident({ id: "critica", severity: "critica" }),
    ];
    expect(prioritizeIncidents(list).map((i) => i.id)).toEqual(["critica", "media", "ack"]);
  });

  it("limita a lista", () => {
    const many = Array.from({ length: 30 }, (_, i) => incident({ id: String(i) }));
    expect(prioritizeIncidents(many, 5)).toHaveLength(5);
  });

  it("semáforo reflete gravidade", () => {
    const base = {
      openCount: 0,
      criticalCount: 0,
      syncFailures: 0,
      reconciliationRequired: 0,
      movimentacoesFailed: 0,
      checkinsFailed: 0,
    };
    expect(healthLevel(base)).toBe("ok");
    expect(healthLevel({ ...base, syncFailures: 2, openCount: 2 })).toBe("atencao");
    expect(healthLevel({ ...base, reconciliationRequired: 1 })).toBe("critico");
    expect(healthLevel({ ...base, criticalCount: 1, openCount: 1 })).toBe("critico");
  });
});
