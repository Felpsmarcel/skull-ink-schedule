import type { AppointmentDraft, DraftServiceLine } from "@/stores/appointment-draft";
import type { StaffMember } from "@/config/staff";
import type { GhlContact } from "@/lib/ghl";

export type DraftValidationReason =
  | "noContact"
  | "noCalendar"
  | "noStaff"
  | "noStart"
  | "noServices"
  | "noProject";

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
  if (!draft.project || draft.project.decision === null) {
    return { ok: false, reason: "noProject" };
  }
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
    case "noProject":
      return "appt.errors.noProject";
  }
}

export type WizardStep = "cliente" | "projeto" | "agenda" | "servicos" | "revisao";

export const WIZARD_STEPS: WizardStep[] = [
  "cliente",
  "projeto",
  "agenda",
  "servicos",
  "revisao",
];

export function reasonToStep(r: DraftValidationReason): WizardStep {
  switch (r) {
    case "noContact":
      return "cliente";
    case "noCalendar":
    case "noStaff":
    case "noStart":
      return "agenda";
    case "noServices":
      return "servicos";
    case "noProject":
      return "projeto";
  }
}

/** First pending step for a draft, or "revisao" when everything is filled. */
export function firstPendingStep(
  draft: import("@/stores/appointment-draft").AppointmentDraft,
  artists: StaffMember[],
): WizardStep {
  const v = validateAppointmentDraft(draft, artists);
  return v.ok ? "revisao" : reasonToStep(v.reason);
}