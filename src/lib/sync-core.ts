import { LOCATION_ID } from "@/config/staff";

export const SYNC_LOCATION_ID = LOCATION_ID;
export const SYNC_DEADLINE_MS = 240_000;
export const SYNC_QUERY_KEYS = [
  "finance-summary",
  "sync-failures",
  "agenda-status",
  "agenda",
  "agenda-range",
  "agenda-status-range",
  "monthly-report",
  "ghl-sync-status",
];

export function ownershipConflict(
  existing: { artist_id: string; calendar_id: string | null } | undefined,
  artistId: string,
  calendarId: string,
  eventCalendar?: string,
) {
  return Boolean(
    (eventCalendar && eventCalendar !== calendarId) ||
    (existing && (existing.artist_id !== artistId || existing.calendar_id !== calendarId)),
  );
}

export function syncFreshness(
  lastSuccess: string | null,
  latestStatus?: string | null,
  now = Date.now(),
) {
  if (latestStatus === "failed" || latestStatus === "expired") return "failed";
  if (latestStatus === "running") return "running";
  if (!lastSuccess || now - Date.parse(lastSuccess) > 20 * 60_000) return "stale";
  return "current";
}
