import { expect, it } from "vitest";
import { agendaScope, scopedAgendaStaff } from "../../src/lib/agenda-scope";
for (const mode of ["day", "week", "month"]) {
  it(`${mode} isolates artist A from B`, () => { const scope = agendaScope({ role: "artist", artistId: "A" }); expect(scopedAgendaStaff([{ id: "A" }, { id: "B" }], scope.artistId, scope.allowed)).toEqual([{ id: "A" }]); });
  it(`${mode} denies an unlinked artist and unknown role`, () => { for (const me of [undefined, { role: "artist", artistId: null }, { role: null, artistId: "A" }, { role: "unknown", artistId: "A" }]) { const scope = agendaScope(me); expect(scope.allowed).toBe(false); expect(scopedAgendaStaff([{ id: "A" }], scope.artistId, scope.allowed)).toEqual([]); } });
}
it("admin retains all calendars", () => { const s = agendaScope({ role: "admin", artistId: null }); expect(scopedAgendaStaff([{ id: "A" }, { id: "B" }], s.artistId, s.allowed)).toHaveLength(2); });