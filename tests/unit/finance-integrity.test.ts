import { expect, it, vi, beforeEach } from "vitest";
import { fetchCrmFinance, summarizeCrmFinance } from "../../src/lib/mcp/crm";
import { fetchStudioPaymentsForClient } from "../../src/lib/mcp/payments";
import type { SupabaseClient } from "@supabase/supabase-js";
const day = "2026-10-25";
const opp = (id: unknown, value: unknown = 100, user = "u-A") => ({ id, monetaryValue: value, assignedTo: user, createdAt: day + "T10:00:00Z", status: "won" });
function crm(pages: unknown[]) { let index = 0; vi.stubGlobal("fetch", vi.fn(async url => Response.json(String(url).includes("pipelines") ? { pipelines: [] } : pages[Math.min(index++, pages.length - 1)]))); }
beforeEach(() => vi.stubEnv("GHL_TOKEN", "fictional"));
for (const meta of [{ total: 3 }, { nextPage: 2, startAfter: 1, startAfterId: "x" }]) it(`empty page is incomplete for ${JSON.stringify(meta)}`, async () => {
  crm([{ opportunities: [], meta }]); const r = await fetchCrmFinance(day, day, new Map());
  expect(r.truncated).toBe(true); const s = summarizeCrmFinance(r.rows, day, day, r.truncated);
  expect(s.total_ganho_eur).toBeNull(); expect(s.registos).toBeNull();
});
for (const entries of [[opp(null)], [opp("")], [opp("x"), opp("x")]]) it("invalid/duplicate IDs never prove complete counts", async () => {
  crm([{ opportunities: entries, meta: { total: entries.length } }]); const r = await fetchCrmFinance(day, day, new Map()); expect(r.truncated).toBe(true); expect(summarizeCrmFinance(r.rows, day, day, r.truncated).registos).toBeNull();
});
for (const meta of [{ nextPage: 2, startAfter: "bad", startAfterId: "x" }, { nextPage: 2, startAfter: 1, startAfterId: "" }, { nextPage: 2, startAfter: 1, startAfterId: "x", total: 1 }]) it("inconsistent cursor/metadata fails closed", async () => {
  crm([{ opportunities: [opp("x")], meta }]); const r = await fetchCrmFinance(day, day, new Map()); expect(r.truncated).toBe(true);
});
it("CRM homonyms retain distinct immutable user IDs and amounts", async () => {
  crm([{ opportunities: [opp("one", 100, "u-A"), opp("two", 250, "u-B")], meta: { total: 2 } }]);
  const r = await fetchCrmFinance(day, day, new Map([["u-A", "Same"], ["u-B", "Same"]])); const s = summarizeCrmFinance(r.rows, day, day, r.truncated);
  expect(s.por_tatuador).toEqual([{ ghl_user_id: "u-B", artist_name: "Same", registos: 1, total_eur: 250 }, { ghl_user_id: "u-A", artist_name: "Same", registos: 1, total_eur: 100 }]);
});
function payments(rows: unknown[]) { const q: any = { select: () => q, is: () => q, gte: () => q, lte: () => q, order: () => q, range: () => q, abortSignal: async () => ({ data: rows, count: rows.length, error: null }) }; return { from: () => q } as unknown as SupabaseClient; }
const pay = (id: string, artist: string, total: unknown) => ({ id, artist_id: artist, total, valor_cartao: total, valor_dinheiro: 0, valor_sumup: 0, valor_transferencia: 0 });
it("app homonyms retain artist IDs and distinct totals", async () => {
  const r = await fetchStudioPaymentsForClient(payments([pay("one", "A", 100), pay("two", "B", 250)]), day, day, new Map([["A", "Same"], ["B", "Same"]]));
  expect(r.por_tatuador).toEqual([{ artist_id: "B", artist_name: "Same", registos: 1, total_eur: 250 }, { artist_id: "A", artist_name: "Same", registos: 1, total_eur: 100 }]);
});
it("missing money in CRM or app never becomes real zero", async () => {
  crm([{ opportunities: [opp("missing", null)], meta: { total: 1 } }]); const r = await fetchCrmFinance(day, day, new Map()); expect(summarizeCrmFinance(r.rows, day, day, r.truncated).total_ganho_eur).toBeNull();
  const p = await fetchStudioPaymentsForClient(payments([pay("missing", "A", null)]), day, day, new Map()); expect(p.total_recebido_eur).toBeNull(); expect(p.registos).toBeNull();
});