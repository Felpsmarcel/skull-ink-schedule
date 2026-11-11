import { describe, it, expect } from "vitest";
import {
  readAllOpportunities,
  artistPipelineId,
  type FetchOpportunityPage,
} from "@/lib/ghl-opportunities-core";

const opp = (i: number, extra: Record<string, unknown> = {}) => ({
  id: `o${i}`,
  name: `n${i}`,
  status: ["open", "won", "lost", "abandoned"][i % 4],
  pipelineId: "p",
  contactId: "C1",
  monetaryValue: 900,
  ...extra,
});
const pages =
  (rows: Record<string, unknown>[], total: number | null = rows.length): FetchOpportunityPage =>
  async (page) => ({ ok: true, rows: rows.slice((page - 1) * 100, page * 100), total });

describe("leitura paginada de oportunidades", () => {
  it("lê mais de 100 em várias páginas, com todos os status", async () => {
    const rows = Array.from({ length: 250 }, (_, i) => opp(i));
    const r = await readAllOpportunities(pages(rows), { expectedContactId: "C1" });
    expect(r).toMatchObject({ complete: true, pagesRead: 3 });
    expect(r.items).toHaveLength(250);
    expect(new Set(r.items.map((o) => o.status))).toEqual(
      new Set(["open", "won", "lost", "abandoned"]),
    );
    expect(r.items[0]!.monetaryValueCents).toBe(90000);
  });
  it("página repetida => incompleto", async () => {
    const first = Array.from({ length: 100 }, (_, i) => opp(i));
    const r = await readAllOpportunities(async () => ({ ok: true, rows: first, total: 300 }));
    expect(r).toMatchObject({ complete: false, reason: "repeated_page" });
  });
  it("erro HTTP no meio => incompleto", async () => {
    const rows = Array.from({ length: 100 }, (_, i) => opp(i));
    const r = await readAllOpportunities(async (p) =>
      p === 1 ? { ok: true, rows, total: 150 } : { ok: false, status: 429 },
    );
    expect(r).toMatchObject({ complete: false, reason: "http_error" });
  });
  it("total contraditório => incompleto", async () => {
    const r = await readAllOpportunities(pages([opp(1), opp(2)], 5));
    expect(r).toMatchObject({ complete: false, reason: "total_mismatch" });
  });
  it("limite de páginas => incompleto", async () => {
    const rows = Array.from({ length: 500 }, (_, i) => opp(i));
    const r = await readAllOpportunities(pages(rows, null), { maxPages: 2 });
    expect(r).toMatchObject({ complete: false, reason: "page_limit" });
  });
  it("oportunidade de outro contato => bloqueia e não devolve nada", async () => {
    const r = await readAllOpportunities(pages([opp(1), opp(2, { contactId: "OUTRO" })]), {
      expectedContactId: "C1",
    });
    expect(r).toMatchObject({ complete: false, reason: "contact_mismatch", items: [] });
  });
  it("funil confirmado só para André; outros = configuração pendente", () => {
    expect(artistPipelineId("8489abdc-3a9a-4114-85a1-a4947da979df")).toBe("eftXuh8pi2jGaXXzpz5O");
    expect(artistPipelineId("00000000-0000-4000-8000-000000000002")).toBeNull();
    expect(artistPipelineId(null)).toBeNull();
  });
});
