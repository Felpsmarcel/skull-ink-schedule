import { describe, it, expect } from "vitest";
import {
  summarizeDistribution as sum,
  forecastCommission as fc,
  parseEuroToCents as eur,
  commercialTotals,
  opportunityContractDivergence as div,
} from "@/lib/project-distribution-core";
import { ANDRE_PAREYN_ARTIST_ID as A } from "@/lib/artist-commission-policy";

const B = "00000000-0000-4000-8000-0000000000b2";
const S = [
  {
    id: "s1",
    artistId: A,
    startAt: "2026-11-30T22:59:00Z",
    status: "completed",
    snapshotPct: 40,
    realizedAt: "2026-11-30T17:00:00Z",
  },
  { id: "s2", artistId: A, startAt: "2026-12-05T09:00:00Z", status: "confirmed", snapshotPct: 40 },
  { id: "s3", artistId: B, startAt: "2026-12-05T09:00:00Z", status: "confirmed", snapshotPct: 50 },
];

describe("distribuição do contrato", () => {
  it("contrato 3000 em 3 sessões continua 3000 (não 9000)", () => {
    const r = sum(300000, S, { s1: 100000, s2: 100000, s3: 100000 });
    expect(r).toMatchObject({
      contractCents: 300000,
      distributedCents: 300000,
      remainingCents: 0,
      valid: true,
    });
  });
  it("mostra sobra", () => {
    expect(sum(300000, S, { s1: 90000 }).remainingCents).toBe(210000);
  });
  it("impede excesso", () => {
    const r = sum(300000, S, { s1: 200000, s2: 150000 });
    expect(r.valid).toBe(false);
    expect(r.issues).toContainEqual({ kind: "exceeds_contract", overCents: 50000 });
  });
  it("impede negativo, fração de centavo, sessão alheia e cancelada", () => {
    const withCancel = [
      ...S,
      {
        id: "sx",
        artistId: A,
        startAt: "2026-12-06T09:00:00Z",
        status: "cancelled",
        snapshotPct: 40,
      },
    ];
    const r = sum(300000, withCancel, { s1: -1, s2: 10.5, outro: 100, sx: 100 });
    expect(r.issues.map((i) => i.kind).sort()).toEqual([
      "cancelled_session",
      "negative",
      "not_integer",
      "unknown_session",
    ]);
    expect(r.distributedCents).toBe(0);
  });
  it("contrato desconhecido não vira zero", () => {
    const r = sum(null, S, {});
    expect(r.remainingCents).toBeNull();
    expect(r.issues).toContainEqual({ kind: "contract_unknown" });
  });
  it("mesma data com tatuadores diferentes são sessões distintas", () => {
    const r = sum(300000, S, { s2: 100000, s3: 100000 });
    expect(r.distributedCents).toBe(200000);
  });
  it("aceita euro em formato PT", () => {
    expect(eur("1.000,50")).toBe(100050);
    expect(eur("900")).toBe(90000);
    expect(eur("")).toBeNull();
    expect(Number.isNaN(eur("abc"))).toBe(true);
  });
});

describe("previsão de comissão", () => {
  const f = fc(S, { s1: 100000, s2: 100000, s3: 100000 });
  it("novembro 35% realizado; dezembro 40% estimado; outro artista mantém gravado", () => {
    expect(f.rows.map((r) => [r.pct, r.recognized])).toEqual([
      [35, true],
      [40, false],
      [50, false],
    ]);
    expect(f.realizedCents).toBe(35000);
    expect(f.estimatedCents).toBe(40000 + 50000);
  });
  it("sinaliza divergência do gravado sem retificar", () => {
    expect(f.rows[0]!.divergentSnapshot).toBe(true);
    expect(f.rows[1]!.divergentSnapshot).toBe(false);
  });
  it("sem valor distribuído => a apurar", () => {
    expect(fc(S, {}).estimatedCents).toBeNull();
  });
  it("repasse congelado mantém gravado", () => {
    const r = fc([{ ...S[0]!, frozen: true }], { s1: 100000 });
    expect(r.rows[0]).toMatchObject({ pct: 40, source: "frozen", shareCents: 40000 });
  });
});

describe("sinal e recebimento sem dupla contagem", () => {
  it("sinal anotado não soma ao recebido", () => {
    expect(
      commercialTotals({ contractCents: 270000, receivedMovCents: 45000, depositNoteCents: 45000 }),
    ).toMatchObject({
      receivedCents: 45000,
      balanceByMovCents: 225000,
    });
  });
  it("recebido desconhecido => saldo a apurar", () => {
    expect(
      commercialTotals({ contractCents: 270000, receivedMovCents: null, depositNoteCents: 45000 })
        .balanceByMovCents,
    ).toBeNull();
  });
});

describe("oportunidade vs contrato", () => {
  it("900 vs 2700 é divergência explícita", () => {
    expect(div(90000, 270000)).toBe("different");
    expect(div(270000, 270000)).toBe("equal");
    expect(div(null, 270000)).toBe("unknown");
    expect(div(90000, null)).toBe("unknown");
  });
  it("concluída sem evidência não entra no realizado", () => {
    const f = fc(
      [
        {
          id: "z",
          artistId: A,
          startAt: "2026-11-20T10:00:00Z",
          status: "completed",
          snapshotPct: 35,
        },
      ],
      { z: 100000 },
    );
    expect(f.rows[0]).toMatchObject({ recognized: false, completedWithoutEvidence: true });
    expect(f.estimatedCents).toBe(35000);
  });
});
