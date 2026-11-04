import { SYNC_LOCATION_ID, normalizeEventContact } from "@/lib/sync-core";

export interface RemoteEvent {
  id?: string;
  calendarId?: string;
  locationId?: string;
  contactId?: string;
  contact?: { id?: string };
  title?: string;
  appointmentStatus?: string;
  startTime?: string;
  endTime?: string;
}
export interface RemoteContact {
  id?: string;
  locationId?: string;
  contactName?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}
export interface ImportArtist {
  id: string;
  ghl_calendar_id: string | null;
  active: boolean;
  commission_pct: number | string | null;
}
export interface Caller {
  role: string | null;
  artistId: string | null;
}

export function mapImportStatus(s: string | undefined): string {
  switch ((s ?? "").toLowerCase()) {
    case "confirmed": return "confirmed";
    case "showed": case "completed": return "completed";
    case "noshow": case "no_show": return "no_show";
    case "cancelled": case "invalid": return "cancelled";
    default: return "pending";
  }
}

type Result =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Fail-closed validation for copying ONE CRM appointment into the app on demand.
 * Never mixes identities and never infers the artist by name.
 */
export function buildImportRow(
  eventId: string,
  event: RemoteEvent | null | undefined,
  contact: RemoteContact | null | undefined,
  artists: ImportArtist[],
  caller: Caller,
): Result {
  if (caller.role !== "admin" && !(caller.role === "artist" && caller.artistId)) {
    return { ok: false, error: "Sem permissão para editar este agendamento." };
  }
  if (!event || event.id !== eventId) return { ok: false, error: "Agendamento não encontrado no CRM." };
  if (event.locationId !== SYNC_LOCATION_ID) return { ok: false, error: "Agendamento fora da subconta GF." };
  if (!event.startTime || !event.endTime || Number.isNaN(Date.parse(event.startTime)) || Number.isNaN(Date.parse(event.endTime))) {
    return { ok: false, error: "Horário inválido no CRM." };
  }
  const matches = artists.filter((a) => a.ghl_calendar_id && a.ghl_calendar_id === event.calendarId);
  if (matches.length !== 1) return { ok: false, error: "Calendário sem tatuador vinculado." };
  const artist = matches[0];
  if (!artist.active) return { ok: false, error: "Tatuador inativo." };
  if (caller.role === "artist" && artist.id !== caller.artistId) {
    return { ok: false, error: "Forbidden: não é seu agendamento" };
  }
  const pct = artist.commission_pct == null ? NaN : Number(artist.commission_pct);
  if (!Number.isFinite(pct)) return { ok: false, error: "Comissão do tatuador não configurada." };

  const declared = normalizeEventContact(event);
  if ((event.contactId?.trim() || event.contact?.id?.trim()) && !declared) {
    return { ok: false, error: "Contato divergente no CRM." };
  }
  let name: string | null = null, phone: string | null = null, email: string | null = null;
  if (declared) {
    if (!contact || contact.id !== declared || contact.locationId !== SYNC_LOCATION_ID) {
      return { ok: false, error: "Contato não pôde ser verificado no CRM." };
    }
    name = contact.contactName?.trim() || contact.name?.trim() ||
      [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() || null;
    phone = contact.phone?.trim() || null;
    email = contact.email?.trim() || null;
  }
  return {
    ok: true,
    row: {
      ghl_appointment_id: eventId,
      ghl_contact_id: declared,
      contact_id: null,
      artist_id: artist.id,
      calendar_id: artist.ghl_calendar_id,
      contact_name: name,
      contact_phone: phone,
      contact_email: email,
      start_at: event.startTime,
      end_at: event.endTime,
      status: mapImportStatus(event.appointmentStatus),
      commission_pct: pct,
      notes: event.title ?? null,
    },
  };
}
