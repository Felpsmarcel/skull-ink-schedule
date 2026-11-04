import { describe, it, expect } from "vitest";
import { buildImportRow } from "@/lib/appointment-import-core";
import { SYNC_LOCATION_ID } from "@/lib/sync-core";

const artists = [
  { id: "a1", ghl_calendar_id: "cal1", active: true, commission_pct: 50 },
  { id: "a2", ghl_calendar_id: "cal2", active: true, commission_pct: 40 },
];
const ev = {
  id: "e1", calendarId: "cal1", locationId: SYNC_LOCATION_ID, contactId: "c1",
  startTime: "2026-11-04T10:00:00Z", endTime: "2026-11-04T12:00:00Z", appointmentStatus: "confirmed",
};
const contact = { id: "c1", locationId: SYNC_LOCATION_ID, name: "Teste Fictício" };
const admin = { role: "admin", artistId: null };

describe("buildImportRow", () => {
  it("admin imports a valid GF event", () => {
    const r = buildImportRow("e1", ev, contact, artists, admin);
    expect(r.ok && r.row.artist_id).toBe("a1");
    expect(r.ok && r.row.commission_pct).toBe(50);
  });
  it("rejects other location", () => {
    expect(buildImportRow("e1", { ...ev, locationId: "x" }, contact, artists, admin).ok).toBe(false);
  });
  it("rejects artist importing another artist's calendar", () => {
    expect(buildImportRow("e1", ev, contact, artists, { role: "artist", artistId: "a2" }).ok).toBe(false);
  });
  it("rejects unverified or foreign contact", () => {
    expect(buildImportRow("e1", ev, null, artists, admin).ok).toBe(false);
    expect(buildImportRow("e1", ev, { ...contact, locationId: "x" }, artists, admin).ok).toBe(false);
    expect(buildImportRow("e1", ev, { ...contact, id: "c2" }, artists, admin).ok).toBe(false);
  });
  it("rejects divergent contactId vs contact.id", () => {
    expect(buildImportRow("e1", { ...ev, contact: { id: "c9" } }, contact, artists, admin).ok).toBe(false);
  });
  it("rejects seller and unknown roles", () => {
    expect(buildImportRow("e1", ev, contact, artists, { role: "seller", artistId: null }).ok).toBe(false);
  });
  it("rejects unmapped calendar", () => {
    expect(buildImportRow("e1", { ...ev, calendarId: "zzz" }, contact, artists, admin).ok).toBe(false);
  });
});
