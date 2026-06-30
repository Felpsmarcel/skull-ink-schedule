import type { GhlContact } from "@/lib/ghl";
import type { DraftServiceLine } from "@/stores/appointment-draft";
import {
  createAppointmentRecord,
  type CreateAppointmentResult,
} from "@/lib/appointments.functions";

export interface FinalizeInput {
  artistId: string;
  calendarId: string;
  locationId: string;
  contact: GhlContact;
  startISO: string;
  endISO: string;
  title: string;
  notes?: string;
  status?: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  services: DraftServiceLine[];
}

export type FinalizeResult = CreateAppointmentResult;

/**
 * Create the appointment in GHL and mirror it in `public.appointments`.
 * The actual write goes through a SECURITY DEFINER server function that
 * authorizes the caller and resolves prices/commission server-side.
 */
export async function finalizeAppointment(input: FinalizeInput): Promise<FinalizeResult> {
  return createAppointmentRecord({
    data: {
      artistId: input.artistId,
      calendarId: input.calendarId,
      locationId: input.locationId,
      contactId: input.contact.id,
      contactName:
        input.contact.contactName ??
        ([input.contact.firstName, input.contact.lastName].filter(Boolean).join(" ") || null),
      contactPhone: input.contact.phone ?? null,
      contactEmail: input.contact.email ?? null,
      startISO: input.startISO,
      endISO: input.endISO,
      title: input.title,
      notes: input.notes ?? null,
      status: input.status ?? "confirmed",
      services: input.services.map((l) => ({
        id: l.service.id,
        discountPct: l.discountPct,
      })),
    },
  });
}