import { z } from "zod";
import type { GhlEvent } from "@/lib/ghl";

const identifier = z
  .string()
  .min(1)
  .refine((value) => value === value.trim());
const optionalText = z
  .string()
  .nullish()
  .transform((value) => value ?? undefined);
const optionalId = identifier.nullish().transform((value) => value ?? undefined);
const instant = z.string().datetime({ offset: true });
const eventSchema = z
  .object({
    id: identifier,
    calendarId: optionalId,
    contactId: optionalId,
    title: optionalText,
    appointmentStatus: optionalText,
    startTime: instant,
    endTime: instant,
    assignedUserId: optionalId,
    contact: z
      .object({
        id: optionalId,
        name: optionalText,
        firstName: optionalText,
        lastName: optionalText,
      })
      .nullish()
      .transform((value) => value ?? undefined),
  })
  .refine((event) => Date.parse(event.endTime) > Date.parse(event.startTime));

/** Invalid reads must never become an empty calendar or authorize zero-valued totals. */
export function parseAgendaEventsResponse(response: unknown, calendarId: string): GhlEvent[] {
  const parsed = z.object({ events: z.array(eventSchema) }).safeParse(response);
  if (
    !parsed.success ||
    parsed.data.events.some(
      (event) =>
        (event.calendarId !== undefined && event.calendarId !== calendarId) ||
        (event.contactId !== undefined &&
          event.contact?.id !== undefined &&
          event.contactId !== event.contact.id),
    )
  ) {
    throw new Error("Resposta dos compromissos inválida ou com vínculo divergente.");
  }
  return parsed.data.events;
}
