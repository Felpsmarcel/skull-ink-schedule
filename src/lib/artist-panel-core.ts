import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { toCents, receivedCents, balanceCents } from "@/lib/project-progress-core";

export const PANEL_TZ = "Europe/Brussels";
export const DEFAULT_PANEL_ARTIST_ID = "8489abdc-3a9a-4114-85a1-a4947da979df";

/** Artist release intentionally blocked until the existing broad RLS is reviewed. */
export function requirePanelAdmin(identity: { role: unknown; artist_id?: unknown } | null) {
  if (identity?.role !== "admin") throw new Response("Forbidden", { status: 403 });
}

export function panelBounds(now: Date, horizon: 30 | 60 | 90) {
  const day = formatInTimeZone(now, PANEL_TZ, "yyyy-MM-dd");
  const shift = (days: number) => {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return fromZonedTime(`${date.toISOString().slice(0, 10)}T00:00:00`, PANEL_TZ).toISOString();
  };
  return { day, start: shift(0), tomorrow: shift(1), end: shift(horizon) };
}

export interface PanelAppointment {
  id: string;
  projectId: string | null;
  name: string;
  startAt: string;
  endAt: string;
  status: string;
  ghlId: string | null;
}

export function projectContinuity(
  id: string,
  appointments: PanelAppointment[] | null,
  now: number,
) {
  if (appointments === null) return { linked: null, done: null, future: null, next: null };
  const linked = appointments.filter((a) => a.projectId === id);
  const future = linked
    .filter((a) => ["confirmed", "pending"].includes(a.status) && Date.parse(a.startAt) >= now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  return {
    linked: linked.length,
    done: linked.filter((a) => a.status === "completed").length,
    future: future.length,
    next: future[0]?.startAt ?? null,
  };
}

export function commercialPresentation(
  quoted: number | string | null,
  deposit: number | string | null,
  movements: { total: number | string | null; tipo: string }[] | null,
) {
  const quotedCents = toCents(quoted);
  const depositCents = toCents(deposit);
  const cash = movements === null ? null : receivedCents(movements);
  // No bridge between the deposit annotation and cash: never deduct both blindly.
  const indicativeBalance =
    movements?.length === 0 &&
    quotedCents !== null &&
    depositCents !== null &&
    depositCents >= 0 &&
    depositCents <= quotedCents
      ? quotedCents - depositCents
      : null;
  return {
    quotedCents,
    depositCents,
    indicativeBalance,
    cash,
    cashBalance: balanceCents(quotedCents, cash),
    needsReconciliation: indicativeBalance === null,
    movementsCount: movements?.length ?? null,
  };
}
