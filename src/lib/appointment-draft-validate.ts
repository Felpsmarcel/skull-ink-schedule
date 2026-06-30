import type { AppointmentDraft, DraftServiceLine } from "@/stores/appointment-draft";
import type { StaffMember } from "@/config/staff";
import type { GhlContact } from "@/lib/ghl";

export type DraftValidationReason =
  | "noContact"
  | "noCalendar"
  | "noStaff"
  | "noStart"
  | "noServices";

export interface ValidatedDraft {
  contact: GhlContact;
  staff: StaffMember;
  startISO: string;
  services: DraftServiceLine[];
  notes: string;
}

export type DraftValidation =
  | { ok: true; data: ValidatedDraft }
  | { ok: false; reason: DraftValidationReason };

export function validateAppointmentDraft(
  draft: AppointmentDraft,
  artists: StaffMember[],
): DraftValidation {
  if (!draft.contact) return { ok: false, reason: "noContact" };
  if (!draft.calendarId) return { ok: false, reason: "noCalendar" };
  const staff = artists.find((a) => a.calendarId === draft.calendarId);
  if (!staff) return { ok: false, reason: "noStaff" };
  if (!draft.startISO) return { ok: false, reason: "noStart" };
  if (!draft.services || draft.services.length === 0) return { ok: false, reason: "noServices" };
  return {
    ok: true,
    data: {
      contact: draft.contact,
      staff,
      startISO: draft.startISO,
      services: draft.services,
      notes: draft.notes,
    },
  };
}

export function reasonToI18nKey(r: DraftValidationReason): string {
  switch (r) {
    case "noContact":
      return "appt.errors.noContact";
    case "noCalendar":
    case "noStaff":
      return "appt.errors.noCalendar";
    case "noStart":
      return "appt.errors.noStart";
    case "noServices":
      return "appt.noServices";
  }
}