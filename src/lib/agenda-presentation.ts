import type { StaffMember } from "@/config/staff";
import type { GhlEvent } from "@/lib/ghl";
import { brusselsDayKey, formatHHmm, type GridSlot } from "@/lib/agenda-grid";

export type AgendaEntry = { event: GhlEvent; staff: StaffMember; issue?: boolean };
export type AgendaReadState = "ready" | "loading" | "partial";

export function appointmentState(status?: string) {
  const value = status?.toLowerCase().replace(/[-\s]/g, "_");
  if (value === "confirmed")
    return { label: "Confirmado", tone: "success" as const, confirmed: true, excluded: false };
  if (value === "showed")
    return { label: "Compareceu · GHL", tone: "info" as const, confirmed: true, excluded: false };
  if (["cancelled", "canceled", "cancel"].includes(value ?? ""))
    return { label: "Cancelado", tone: "neutral" as const, confirmed: false, excluded: true };
  if (["no_show", "noshow"].includes(value ?? ""))
    return { label: "Não compareceu", tone: "neutral" as const, confirmed: false, excluded: true };
  if (["new", "pending", "unconfirmed"].includes(value ?? ""))
    return { label: "A confirmar", tone: "warning" as const, confirmed: false, excluded: false };
  if (["done", "completed"].includes(value ?? ""))
    return { label: "Concluído · GHL", tone: "info" as const, confirmed: true, excluded: false };
  return {
    label: "Status a conferir",
    tone: "neutral" as const,
    confirmed: false,
    excluded: false,
  };
}

/** Keep one card per event, but never turn contradictory or malformed reads into verified totals. */
export function readAgendaEntries(
  groups: readonly { staff: StaffMember; events: readonly GhlEvent[] }[],
  startMs: number,
  endExclusiveMs: number,
): { entries: AgendaEntry[]; hasIssues: boolean } {
  const byKey = new Map<string, AgendaEntry>();
  let hasIssues = false;
  for (const { staff, events } of groups) {
    for (const event of events) {
      const start = Date.parse(event?.startTime);
      if (!event || typeof event.id !== "string" || !event.id.trim() || !Number.isFinite(start)) {
        hasIssues = true;
        continue;
      }
      const issue = Boolean(event.calendarId && event.calendarId !== staff.calendarId);
      hasIssues ||= issue;
      const key = `${staff.calendarId}:${event.id}`;
      const previous = byKey.get(key);
      if (previous) {
        const equivalent =
          previous.staff.id === staff.id &&
          previous.event.calendarId === event.calendarId &&
          previous.event.startTime === event.startTime &&
          previous.event.endTime === event.endTime &&
          previous.event.appointmentStatus === event.appointmentStatus &&
          previous.event.contactId === event.contactId &&
          previous.event.contact?.id === event.contact?.id &&
          previous.event.title === event.title;
        if (!equivalent) {
          previous.issue = true;
          hasIssues = true;
        }
      } else {
        byKey.set(key, { event, staff, ...(issue ? { issue: true } : {}) });
      }
    }
  }
  return {
    entries: [...byKey.values()]
      .filter(({ event }) => {
        const start = Date.parse(event.startTime);
        return start >= startMs && start < endExclusiveMs;
      })
      .sort(
        (a, b) =>
          Date.parse(a.event.startTime) - Date.parse(b.event.startTime) ||
          a.event.id.localeCompare(b.event.id),
      ),
    hasIssues,
  };
}

export function agendaEntries(
  groups: readonly { staff: StaffMember; events: readonly GhlEvent[] }[],
  startMs: number,
  endExclusiveMs: number,
): AgendaEntry[] {
  return readAgendaEntries(groups, startMs, endExclusiveMs).entries;
}

export function agendaOperationSummary(entries: readonly AgendaEntry[]) {
  const active = entries.filter(({ event }) => !appointmentState(event.appointmentStatus).excluded);
  const confirmed = active.filter(
    ({ event }) => appointmentState(event.appointmentStatus).confirmed,
  ).length;
  return {
    count: entries.length,
    active: active.length,
    confirmed,
    rate: active.length ? Math.round((confirmed / active.length) * 100) : null,
  };
}

export function entryDay(entry: AgendaEntry) {
  return brusselsDayKey(new Date(entry.event.startTime));
}

export function entryName(entry: AgendaEntry) {
  return (
    entry.event.contact?.name ||
    [entry.event.contact?.firstName, entry.event.contact?.lastName].filter(Boolean).join(" ") ||
    "Cliente a identificar"
  );
}

export function eventGridSlot(entry: AgendaEntry): GridSlot {
  const { event } = entry;
  const start = Date.parse(event.startTime),
    end = Date.parse(event.endTime);
  return {
    startMs: start,
    label: formatHHmm(start),
    status: "booked",
    contactName: entryName(entry),
    contactId: event.contactId ?? event.contact?.id,
    ghlEventId: event.id,
    appointmentStatus: event.appointmentStatus,
    eventStartMs: start,
    eventEndMs: Number.isFinite(end) ? end : undefined,
    isFirstSlot: true,
    spanSlots: 1,
    serviceName: event.title,
  };
}

export function valueEvent(entry: AgendaEntry) {
  return {
    id: entry.event.id,
    calendarId: entry.event.calendarId ?? entry.staff.calendarId,
    artistId: entry.staff.id,
    status: entry.event.appointmentStatus,
    startTime: entry.event.startTime,
  };
}
export const agendaMoney = (cents: number | null | undefined) =>
  cents == null
    ? "A conferir"
    : new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);
