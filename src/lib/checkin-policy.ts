import type { CheckinStatus } from "@/lib/checkin.functions";
import { financePeriodBounds } from "@/lib/finance-list-filters";

export function checkinDayBounds(now = new Date()) {
  const bounds = financePeriodBounds("today", now)!;
  return {
    startISO: new Date(bounds.from).toISOString(),
    endISO: new Date(bounds.to).toISOString(),
  };
}

export function requireReceptionRole(row: { role?: string | null } | null) {
  if (row?.role !== "admin") throw new Error("Check-in disponível apenas na sessão da recepção.");
}

export interface CheckinIdentityInput {
  nome: string;
  telefone?: string | null;
  contactId?: string | null;
  ghlContactId?: string | null;
  appointmentId?: string | null;
  artistId?: string | null;
  scheduledAtISO?: string | null;
  consentimento?: boolean;
}
export interface CheckinContact {
  id: string;
  name: string | null;
  phone: string | null;
  ghl_contact_id: string | null;
}
export interface CheckinAppointment {
  id: string;
  contact_id: string | null;
  artist_id: string | null;
  start_at: string;
  status: string;
}

/** Browser labels and foreign IDs are never the source of an existing client's identity. */
export function canonicalCheckinInput(
  input: CheckinIdentityInput,
  contact: CheckinContact | null,
  appointment: CheckinAppointment | null,
  now = new Date(),
): CheckinIdentityInput {
  if (!input.contactId) {
    if (input.ghlContactId || input.appointmentId || input.artistId || input.scheduledAtISO)
      throw new Error("Vínculo de atendimento não verificado.");
    return {
      nome: input.nome.trim(),
      telefone: input.telefone?.trim() || null,
      consentimento: input.consentimento === true,
    };
  }
  if (!contact || contact.id !== input.contactId) throw new Error("Cliente indisponível.");
  if (input.appointmentId) {
    const bounds = checkinDayBounds(now);
    const start = Date.parse(appointment?.start_at ?? "");
    if (
      !appointment ||
      appointment.id !== input.appointmentId ||
      appointment.contact_id !== contact.id ||
      !Number.isFinite(start) ||
      start < Date.parse(bounds.startISO) ||
      start >= Date.parse(bounds.endISO) ||
      !["pending", "confirmed"].includes(appointment.status)
    )
      throw new Error(
        "Agendamento não corresponde a este cliente e dia, ou não está disponível para chegada.",
      );
  }
  return {
    nome: contact.name?.trim() || input.nome.trim(),
    telefone: contact.phone,
    contactId: contact.id,
    ghlContactId: contact.ghl_contact_id,
    appointmentId: input.appointmentId ? appointment!.id : null,
    artistId: input.appointmentId ? appointment!.artist_id : null,
    scheduledAtISO: input.appointmentId ? appointment!.start_at : null,
    consentimento: input.consentimento === true,
  };
}

const ALLOWED_CHECKIN_TRANSITIONS: Record<CheckinStatus, readonly CheckinStatus[]> = {
  aguardando: ["em_atendimento", "nao_compareceu", "cancelado"],
  em_atendimento: ["concluido", "cancelado"],
  concluido: [],
  nao_compareceu: [],
  cancelado: [],
};

/** Final statuses never reopen and timestamps are attached only to a legal transition. */
export function checkinTransitionPatch(
  current: CheckinStatus,
  next: CheckinStatus,
  now = new Date(),
) {
  if (!ALLOWED_CHECKIN_TRANSITIONS[current]?.includes(next)) {
    throw new Error("O estado da fila mudou ou esta transição não é permitida. Atualize a fila.");
  }
  const patch: { status: CheckinStatus; started_at?: string; finished_at?: string } = {
    status: next,
  };
  if (next === "em_atendimento") patch.started_at = now.toISOString();
  if (next === "concluido") patch.finished_at = now.toISOString();
  return patch;
}
