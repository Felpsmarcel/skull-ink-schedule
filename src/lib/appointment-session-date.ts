import { brusselsDayKey } from "@/lib/agenda-grid";

/** A time belongs to its Brussels civil date, not the calendar's displayed month. */
export function sessionStartForDay(startISO: string | null, day: Date): string | null {
  if (!startISO) return null;
  const start = new Date(startISO);
  if (!Number.isFinite(start.getTime())) return null;
  return brusselsDayKey(start) === brusselsDayKey(day) ? startISO : null;
}
