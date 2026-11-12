import { describe, expect, it } from "vitest";
import {
  canonicalCheckinInput,
  checkinDayBounds,
  requireReceptionRole,
} from "@/lib/checkin-policy";

const now = new Date("2026-11-12T12:00:00Z");
const contact = {
  id: "contact-a",
  name: "Pessoa correta",
  phone: "telefone correto",
  ghl_contact_id: "ghl-a",
};
const appt = {
  id: "appointment-a",
  contact_id: "contact-a",
  artist_id: "artist-a",
  start_at: "2026-11-12T09:00:00Z",
  status: "confirmed",
};
const input = {
  nome: "Nome adulterado",
  telefone: "outro telefone",
  contactId: "contact-a",
  appointmentId: "appointment-a",
  ghlContactId: "ghl-b",
  artistId: "artist-b",
  scheduledAtISO: "2026-12-15T09:00:00Z",
  consentimento: true,
};

describe("check-in identity and civil dates", () => {
  it.each([null, { role: "artist" }, { role: "seller" }, { role: "unknown" }])(
    "rejects non-reception identity %j",
    (identity) => {
      expect(() => requireReceptionRole(identity)).toThrow();
    },
  );
  it("uses canonical contact and appointment instead of supplied foreign labels and IDs", () => {
    const result = canonicalCheckinInput(input, contact, appt, now);
    expect(result).toMatchObject({
      nome: contact.name,
      telefone: contact.phone,
      ghlContactId: "ghl-a",
      artistId: "artist-a",
      scheduledAtISO: appt.start_at,
    });
  });
  it.each([
    { ...appt, contact_id: "contact-b" },
    { ...appt, id: "appointment-b" },
    { ...appt, status: "cancelled" },
    { ...appt, start_at: "2026-11-12T23:00:00Z" },
    { ...appt, start_at: "invalid" },
    null,
  ])("rejects mismatched, unavailable or outside-day appointments %j", (bad) => {
    expect(() => canonicalCheckinInput(input, contact, bad, now)).toThrow();
  });
  it("does not attach arbitrary CRM IDs to a walk-in", () => {
    expect(() =>
      canonicalCheckinInput({ nome: "Nova pessoa", ghlContactId: "forged" }, null, null, now),
    ).toThrow();
    expect(canonicalCheckinInput({ nome: " Nova pessoa " }, null, null, now)).toEqual({
      nome: "Nova pessoa",
      telefone: null,
      consentimento: false,
    });
  });
  it("does not infer artist or appointment when none is selected", () => {
    expect(
      canonicalCheckinInput({ ...input, appointmentId: null }, contact, null, now),
    ).toMatchObject({ appointmentId: null, artistId: null, scheduledAtISO: null });
  });
  it.each([
    ["2026-03-29T12:00:00Z", 23],
    ["2026-10-25T12:00:00Z", 25],
    ["2026-11-12T12:00:00Z", 24],
  ])("honors Brussels day %s (%s hours)", (day, hours) => {
    const bounds = checkinDayBounds(new Date(day));
    expect((Date.parse(bounds.endISO) - Date.parse(bounds.startISO)) / 3600000).toBe(hours);
  });
});
