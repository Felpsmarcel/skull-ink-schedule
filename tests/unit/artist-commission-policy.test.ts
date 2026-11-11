import { describe, it, expect } from "vitest";
import {
  ANDRE_PAREYN_ARTIST_ID as ANDRE,
  RANDEVU_CALENDAR_ID,
  resolveSessionCommission as r,
  sessionArtistShareCents as share,
  canViewArtistCommission as can,
  projectSharedRandevu,
} from "@/lib/artist-commission-policy";

const OTHER = "00000000-0000-4000-8000-000000000002";
const base = { artistId: ANDRE, status: "completed", snapshotPct: 40 };

describe("comissão André por data de realização (Bruxelas)", () => {
  it("30/11 23:59 Bruxelas = 35%", () => {
    expect(r({ ...base, startAt: "2026-11-30T22:59:59Z" })).toMatchObject({
      pct: 35,
      source: "policy",
      effectiveDate: "2026-11-30",
    });
  });
  it("01/12 00:00 Bruxelas (30/11 23:00 UTC) = 40%", () => {
    expect(r({ ...base, startAt: "2026-11-30T23:00:00Z" })).toMatchObject({
      pct: 40,
      effectiveDate: "2026-12-01",
    });
  });
  it("01/11 00:30 Bruxelas (31/10 23:30 UTC) = 35%", () => {
    expect(r({ ...base, startAt: "2026-10-31T23:30:00Z" }).pct).toBe(35);
  });
  it("outubro preserva o percentual gravado", () => {
    expect(r({ ...base, snapshotPct: 40, startAt: "2026-10-31T22:59:00Z" })).toMatchObject({
      pct: 40,
      source: "snapshot",
    });
  });
  it("outro artista preserva o gravado", () => {
    expect(
      r({ ...base, artistId: OTHER, snapshotPct: 50, startAt: "2026-11-15T10:00:00Z" }),
    ).toMatchObject({ pct: 50, source: "snapshot" });
  });
  it("sessão não realizada é só estimativa", () => {
    expect(r({ ...base, status: "confirmed", startAt: "2026-12-05T09:00:00Z" })).toMatchObject({
      pct: 40,
      recognized: false,
    });
    expect(r({ ...base, startAt: "2026-12-05T09:00:00Z" }).recognized).toBe(true);
  });
  it("repasse pago/congelado mantém o gravado", () => {
    expect(
      r({ ...base, frozen: true, snapshotPct: 40, startAt: "2026-11-10T10:00:00Z" }),
    ).toMatchObject({ pct: 40, source: "frozen" });
  });
  it("Randevu/consulta não é sessão", () => {
    expect(
      r({ ...base, calendarId: RANDEVU_CALENDAR_ID, startAt: "2026-11-01T10:30:00Z" }),
    ).toMatchObject({ pct: null, source: "not_session" });
    expect(r({ ...base, isConsultation: true, startAt: "2026-11-01T10:30:00Z" }).pct).toBeNull();
  });
  it("cancelada não gera comissão", () => {
    expect(r({ ...base, status: "cancelled", startAt: "2026-12-05T09:00:00Z" }).pct).toBeNull();
  });
  it("900€ por sessão: 315€ em novembro, 360€ em dezembro; sem multiplicar contrato", () => {
    expect(share(90000, 35)).toBe(31500);
    expect(share(90000, 40)).toBe(36000);
    expect(share(null, 40)).toBeNull();
    expect(share(90000, null)).toBeNull();
  });
});

describe("acesso à comissão", () => {
  it("admin vê qualquer; artista só a própria; outros negados", () => {
    expect(can({ role: "admin", artistId: null }, OTHER)).toBe(true);
    expect(can({ role: "artist", artistId: ANDRE }, ANDRE)).toBe(true);
    expect(can({ role: "artist", artistId: ANDRE }, OTHER)).toBe(false);
    expect(can({ role: "artist", artistId: null }, ANDRE)).toBe(false);
    expect(can({ role: "seller", artistId: null }, ANDRE)).toBe(false);
    expect(can(null, ANDRE)).toBe(false);
  });
});

describe("Randevu compartilhado", () => {
  it("só calendário configurado e sem notas/finanças", () => {
    const out = projectSharedRandevu([
      {
        id: "a",
        calendarId: RANDEVU_CALENDAR_ID,
        startAt: "s",
        endAt: "e",
        status: "confirmed",
        contactName: "X",
        notes: "privado",
        total_eur: 900,
      },
      {
        id: "b",
        calendarId: "outro",
        startAt: "s",
        endAt: "e",
        status: "confirmed",
        contactName: "Y",
      },
    ]);
    expect(out).toEqual([
      { id: "a", startAt: "s", endAt: "e", status: "confirmed", contactName: "X" },
    ]);
  });
});
