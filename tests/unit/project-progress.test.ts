import { describe, expect, it } from "vitest";
import { artistShareCents, balanceCents, receivedCents, sessionProgress, toCents } from "@/lib/project-progress-core";

const now = Date.parse("2026-11-11T00:00:00Z");
const s = (id: string, startAt: string, status: string) => ({ id, startAt, status });

describe("projeto multi-sessões", () => {
  it("3 sessões de 900 € contam o integral de 2.700 € uma única vez", () => {
    expect(balanceCents(toCents(2700), receivedCents([]))).toBe(270000);
  });
  it("sinal de 450 € abate do saldo", () => {
    expect(balanceCents(270000, receivedCents([{ total: 450, tipo: "sinal" }]))).toBe(225000);
  });
  it("estorno reduz o recebido", () => {
    expect(receivedCents([{ total: 900, tipo: "sessao" }, { total: 100, tipo: "estorno" }])).toBe(80000);
  });
  it("valor ausente fica A apurar (null), não zero", () => {
    expect(receivedCents([{ total: null, tipo: "sessao" }])).toBeNull();
    expect(balanceCents(null, 0)).toBeNull();
    expect(balanceCents(0, 0)).toBeNull();
  });
  it("artista recebe 35% sobre o recebido", () => {
    expect(artistShareCents(90000)).toBe(31500);
    expect(artistShareCents(null)).toBeNull();
  });
  it("remarcação cancelada não conta como sessão a mais", () => {
    const p = sessionProgress(
      [s("a", "2026-12-05T09:00:00Z", "completed"), s("b", "2026-12-06T09:00:00Z", "cancelled"), s("c", "2026-12-13T09:00:00Z", "confirmed"), s("d", "2026-12-20T09:00:00Z", "pending")],
      now,
    );
    expect(p).toEqual({ total: 3, done: 1, nextStartAt: "2026-12-13T09:00:00Z" });
  });
});
