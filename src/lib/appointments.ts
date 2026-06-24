import { supabase } from "@/integrations/supabase/client";
import {
  createAppointment,
  type CreateAppointmentResponse,
  type GhlContact,
} from "@/lib/ghl";
import type { DraftServiceLine } from "@/stores/appointment-draft";

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
  totalEur: number;
  originalEur: number;
  /** Defaults to 40 (commission base for the artist). */
  commissionPct?: number;
}

export interface FinalizeResult {
  ghl: CreateAppointmentResponse | { message?: string };
  ghlEventId: string | null;
  appointmentId: string;
}

/**
 * Create the appointment in GHL and mirror it in `public.appointments` so we
 * have the total value as the base for the artist's commission.
 */
export async function finalizeAppointment(input: FinalizeInput): Promise<FinalizeResult> {
  const ghlRes = await createAppointment({
    calendarId: input.calendarId,
    locationId: input.locationId,
    contactId: input.contact.id,
    startTime: input.startISO,
    endTime: input.endISO,
    title: input.title,
    notes: input.notes,
    appointmentStatus:
      input.status === "pending" || input.status === "cancelled" ? "new" : "confirmed",
  });
  if (!ghlRes.ok) {
    const msg = (ghlRes.data as { message?: string })?.message ?? `GHL ${ghlRes.status}`;
    throw new Error(msg);
  }

  const ghlEventId = (ghlRes.data as { id?: string })?.id ?? null;

  const row = {
    ghl_appointment_id: ghlEventId,
    ghl_contact_id: input.contact.id,
    artist_id: input.artistId,
    calendar_id: input.calendarId,
    contact_name:
      input.contact.contactName ??
      ([input.contact.firstName, input.contact.lastName].filter(Boolean).join(" ") || null),
    contact_phone: input.contact.phone ?? null,
    contact_email: input.contact.email ?? null,
    start_at: input.startISO,
    end_at: input.endISO,
    status: input.status ?? "confirmed",
    total_eur: round2(input.totalEur),
    original_eur: round2(input.originalEur),
    commission_pct: input.commissionPct ?? 40,
    services: input.services.map((l) => ({
      id: l.service.id,
      name: l.service.name,
      duration_min: l.service.duration_min,
      modality: l.service.modality,
      price_eur: l.service.price_eur,
      discount_pct: l.discountPct,
      final_eur: round2(l.service.price_eur * (1 - l.discountPct / 100)),
    })),
    notes: input.notes ?? null,
  };

  // Generated types don't include `appointments` yet — loose cast.
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => {
      insert: (r: unknown) => {
        select: (c: string) => {
          single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
        };
      };
    };
  })
    .from("appointments")
    .insert(row)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Agendado no GHL${ghlEventId ? ` (${ghlEventId})` : ""}, mas falhou ao salvar no banco: ${error?.message ?? "sem dado"}`,
    );
  }

  return { ghl: ghlRes.data, ghlEventId, appointmentId: data.id };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
