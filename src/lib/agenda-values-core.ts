import { RANDEVU_CALENDAR_ID } from "@/lib/artist-commission-policy";

/** Local session annotations. These values never prove a receipt, sale or payout. */
export interface AgendaValueItem {
  ghlEventId: string;
  artistId: string;
  calendarId: string;
  startTime: string;
  totalCents: number | null;
  depositCents: number | null;
  projectId: string | null;
}

export type AgendaValuesSource =
  | { state: "ready"; items: AgendaValueItem[] }
  | { state: "unavailable"; items: []; reason: string };

export interface AgendaValueEvent {
  id: string;
  calendarId: string;
  artistId: string;
  startTime: string;
  status?: string;
}

export interface AgendaValuesSummary {
  includedCount: number;
  excludedCount: number;
  unknownCount: number;
  totalCents: number | null;
  depositCents: number | null;
  differenceCents: number | null;
  paymentProof: false;
}

export function agendaMoneyCents(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && !!value.trim() && value === value.trim();
}

function validCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function timestamp(value: string): number | null {
  // Require an explicit zone; local-machine date parsing must not change identity.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    return null;
  const civilDate = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (
    !Number.isFinite(civilDate.getTime()) ||
    civilDate.toISOString().slice(0, 10) !== value.slice(0, 10)
  )
    return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameEvent(left: AgendaValueEvent, right: AgendaValueEvent): boolean {
  return (
    left.artistId === right.artistId &&
    left.calendarId === right.calendarId &&
    timestamp(left.startTime) === timestamp(right.startTime) &&
    normalizedStatus(left.status) === normalizedStatus(right.status)
  );
}

function normalizedStatus(status: string | undefined): string {
  return (status ?? "").toLowerCase().replace(/[\s_-]/g, "");
}

export function agendaValueExcluded(event: AgendaValueEvent): boolean {
  return (
    event.calendarId === RANDEVU_CALENDAR_ID ||
    ["cancel", "cancelled", "canceled", "noshow"].includes(normalizedStatus(event.status))
  );
}

function sourceIndex(source: AgendaValuesSource): Map<string, AgendaValueItem> | null {
  if (source.state !== "ready") return null;
  const index = new Map<string, AgendaValueItem>();
  for (const item of source.items) {
    if (
      !validId(item.ghlEventId) ||
      !validId(item.artistId) ||
      !validId(item.calendarId) ||
      timestamp(item.startTime) === null ||
      (item.projectId !== null && !validId(item.projectId)) ||
      (item.totalCents !== null && !validCents(item.totalCents)) ||
      (item.depositCents !== null && !validCents(item.depositCents)) ||
      index.has(item.ghlEventId)
    )
      return null;
    index.set(item.ghlEventId, item);
  }
  return index;
}

function matchEvent(event: AgendaValueEvent, index: Map<string, AgendaValueItem> | null) {
  const item = index?.get(event.id);
  if (
    !item ||
    !validId(event.id) ||
    item.artistId !== event.artistId ||
    item.calendarId !== event.calendarId ||
    timestamp(event.startTime) === null ||
    timestamp(item.startTime) !== timestamp(event.startTime)
  )
    return null;
  return item;
}

export function agendaValueForEvent(
  event: AgendaValueEvent,
  source: AgendaValuesSource,
): AgendaValueItem | null {
  return matchEvent(event, sourceIndex(source));
}

/** Deduplicate rendered slots by immutable event ID; incomplete coverage never produces a total. */
export function summarizeAgendaValues(
  events: readonly AgendaValueEvent[],
  source: AgendaValuesSource,
  eventsComplete = true,
): AgendaValuesSummary {
  const index = sourceIndex(source);
  const unique = new Map<string, AgendaValueEvent>();
  const conflicts = new Set<string>();
  for (const event of events) {
    const previous = unique.get(event.id);
    if (previous && !sameEvent(previous, event)) conflicts.add(event.id);
    else if (!previous) unique.set(event.id, event);
  }
  let includedCount = 0;
  let excludedCount = 0;
  let unknownCount = 0;
  let totalCents = 0;
  let depositCents = 0;
  for (const event of unique.values()) {
    // Conflicting status/identity cannot be quietly excluded by whichever row came first.
    if (!conflicts.has(event.id) && agendaValueExcluded(event)) {
      excludedCount++;
      continue;
    }
    includedCount++;
    const item = conflicts.has(event.id) ? null : matchEvent(event, index);
    if (
      !item ||
      !validCents(item.totalCents) ||
      !validCents(item.depositCents) ||
      item.depositCents > item.totalCents
    ) {
      unknownCount++;
      continue;
    }
    totalCents += item.totalCents;
    depositCents += item.depositCents;
  }
  const complete =
    eventsComplete &&
    index !== null &&
    unknownCount === 0 &&
    Number.isSafeInteger(totalCents) &&
    Number.isSafeInteger(depositCents);
  return {
    includedCount,
    excludedCount,
    unknownCount,
    totalCents: complete ? totalCents : null,
    depositCents: complete ? depositCents : null,
    differenceCents: complete ? totalCents - depositCents : null,
    paymentProof: false,
  };
}
