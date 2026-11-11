import { describe, expect, it } from "vitest";
import {
  SaveDraftSchema,
  evaluateOpportunityLink,
  mapRpcError,
  persistenceEnabled,
} from "@/lib/project-allocation-core";
import { fixtureAdapter, fixtureBumpVersion } from "@/lib/project-allocation-adapter";

const U = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const K = "alloc-0123456789abcdef";

describe("contrato de persistência", () => {
  it("adaptador de produção desligado sem a flag exata", () => {
    expect(persistenceEnabled(undefined)).toBe(false);
    expect(persistenceEnabled("true")).toBe(false);
    expect(persistenceEnabled("enabled")).toBe(true);
  });
  it("payload: centavos inteiros, sem duplicatas", () => {
    const base = { projectId: U(1), expectedVersion: 0, idempotencyKey: K };
    expect(
      SaveDraftSchema.safeParse({ ...base, lines: [{ appointmentId: U(2), amountCents: 90000 }] })
        .success,
    ).toBe(true);
    expect(
      SaveDraftSchema.safeParse({ ...base, lines: [{ appointmentId: U(2), amountCents: 10.5 }] })
        .success,
    ).toBe(false);
    expect(
      SaveDraftSchema.safeParse({ ...base, lines: [{ appointmentId: U(2), amountCents: -1 }] })
        .success,
    ).toBe(false);
    expect(
      SaveDraftSchema.safeParse({
        ...base,
        lines: [
          { appointmentId: U(2), amountCents: 1 },
          { appointmentId: U(2), amountCents: 2 },
        ],
      }).success,
    ).toBe(false);
  });
  it("mapeia erros da RPC", () => {
    expect(mapRpcError("ERROR: version_conflict")).toBe("version_conflict");
    expect(mapRpcError("exceeds_contract")).toBe("exceeds_contract");
    expect(mapRpcError("boom")).toBe("unknown");
  });
  it("oportunidade 900 x contrato 2700 exige decisão; lost é histórico", () => {
    expect(
      evaluateOpportunityLink({
        status: "open",
        valueCents: 90000,
        contractCents: 270000,
        keepContract: false,
      }),
    ).toEqual({ kind: "active", needsDecision: true });
    expect(
      evaluateOpportunityLink({
        status: "open",
        valueCents: 90000,
        contractCents: 270000,
        keepContract: true,
      }).needsDecision,
    ).toBe(false);
    expect(
      evaluateOpportunityLink({
        status: "won",
        valueCents: 270000,
        contractCents: 270000,
        keepContract: false,
      }).needsDecision,
    ).toBe(false);
    expect(
      evaluateOpportunityLink({
        status: "lost",
        valueCents: 90000,
        contractCents: 270000,
        keepContract: false,
      }),
    ).toEqual({ kind: "historical", needsDecision: false });
  });
});

describe("adaptador fixture", () => {
  it("salvar → recarregar, dupla submissão e conflito", async () => {
    const a = fixtureAdapter("fx-1", 270000, [U(1), U(2), U(3)]);
    const lines = [U(1), U(2), U(3)].map((appointmentId) => ({
      appointmentId,
      amountCents: 90000,
    }));
    expect(await a.save({ expectedVersion: 0, idempotencyKey: K, lines })).toEqual({
      state: "saved",
      version: 1,
      replayed: false,
    });
    expect(await a.save({ expectedVersion: 0, idempotencyKey: K, lines })).toEqual({
      state: "saved",
      version: 1,
      replayed: true,
    });
    const r = await a.load();
    expect(r.state === "ready" && r.environment).toBe("fixture");
    expect(r.state === "ready" && r.lines[U(2)]).toBe(90000);
    fixtureBumpVersion("fx-1");
    expect(await a.save({ expectedVersion: 1, idempotencyKey: K + "x", lines })).toEqual({
      state: "conflict",
    });
    expect(
      await a.save({
        expectedVersion: 2,
        idempotencyKey: K + "y",
        lines: [{ appointmentId: U(9), amountCents: 1 }],
      }),
    ).toEqual({ state: "rejected", reason: "foreign_session" });
  });
});
