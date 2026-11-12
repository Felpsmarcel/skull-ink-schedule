import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
const TIMEZONE = "Europe/Brussels";

/** Validate a civil date from navigation without accepting normalized invalid days. */
export function parseAgendaLinkDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = fromZonedTime(`${value}T12:00:00`, TIMEZONE);
  if (!Number.isFinite(date.getTime()) || formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd") !== value)
    return undefined;
  return date;
}

/** Appointment timestamps determine the visible Brussels day; IDs stay independent. */
export function agendaLinkDay(startAt: string): string | undefined {
  const date = new Date(startAt);
  return Number.isFinite(date.getTime())
    ? formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd")
    : undefined;
}
