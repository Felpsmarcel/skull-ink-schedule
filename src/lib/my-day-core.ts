import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const MY_DAY_TZ = "Europe/Brussels";
export function myDayBounds(now: Date) {
  const day = formatInTimeZone(now, MY_DAY_TZ, "yyyy-MM-dd");
  const next = new Date(`${day}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    day,
    start: fromZonedTime(`${day}T00:00:00`, MY_DAY_TZ).toISOString(),
    end: fromZonedTime(`${next.toISOString().slice(0, 10)}T00:00:00`, MY_DAY_TZ).toISOString(),
  };
}

export function canReadMyDay(role: unknown) {
  return role === "admin";
}
export interface DayAppointment {
  id: string;
  ghlId: string | null;
  name: string;
  artist: string | null;
  start: string;
  status: string;
}
export interface DayCheckin {
  id: string;
  appointmentId: string | null;
  ghlId: string | null;
  name: string;
  status: string;
  arrived: string;
  started: string | null;
  finished: string | null;
}
export type DayState =
  | "unverified"
  | "waiting"
  | "in_progress"
  | "finished"
  | "absent"
  | "cancelled"
  | "conflict";
export interface DayRow {
  appointment: DayAppointment;
  checkin: DayCheckin | null;
  state: DayState;
}
export function myDaySummary(rows: DayRow[] | null, checkins: DayCheckin[] | null) {
  return {
    expected: rows?.length ?? null,
    arrived: checkins
      ? checkins.filter((c) => ["aguardando", "em_atendimento", "concluido"].includes(c.status))
          .length
      : null,
    inProgress: checkins ? checkins.filter((c) => c.status === "em_atendimento").length : null,
    finished: checkins ? checkins.filter((c) => c.status === "concluido").length : null,
    unverified: rows && checkins ? rows.filter((r) => r.state === "unverified").length : null,
  };
}
export function checkinState(status: string): DayState {
  switch (status) {
    case "aguardando":
      return "waiting";
    case "em_atendimento":
      return "in_progress";
    case "concluido":
      return "finished";
    case "nao_compareceu":
      return "absent";
    case "cancelado":
      return "cancelled";
    default:
      return "unverified";
  }
}

/** Only immutable appointment IDs prove correlation. Conflicts remain separate. */
export function correlateMyDay(appointments: DayAppointment[], checkins: DayCheckin[]) {
  const local = new Map(appointments.map((a) => [a.id, a]));
  const repeated = new Set(
    appointments
      .filter((a, i) => appointments.findIndex((b) => b.id === a.id) !== i)
      .map((a) => a.id),
  );
  const linked = new Map<string, DayCheckin[]>();
  const conflict = new Set<string>();
  const unresolved = new Set<string>();
  for (const c of checkins) {
    const byLocal = c.appointmentId ? local.get(c.appointmentId) : undefined;
    const byGhl = c.ghlId ? appointments.filter((a) => a.ghlId === c.ghlId) : [];
    if (
      (byLocal && repeated.has(byLocal.id)) ||
      byGhl.length > 1 ||
      (byLocal && c.ghlId && byLocal.ghlId && c.ghlId !== byLocal.ghlId) ||
      (c.appointmentId && !byLocal && byGhl.length > 0)
    ) {
      if (byLocal) conflict.add(byLocal.id);
      for (const a of byGhl) conflict.add(a.id);
      unresolved.add(c.id);
      continue;
    }
    const a = byLocal ?? byGhl[0];
    if (!a) {
      unresolved.add(c.id);
      continue;
    }
    linked.set(a.id, [...(linked.get(a.id) ?? []), c]);
  }
  const rows: DayRow[] = [...appointments]
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
    .map((a) => {
      const cs = linked.get(a.id) ?? [];
      if (cs.length > 1 || conflict.has(a.id)) {
        for (const c of cs) unresolved.add(c.id);
        return { appointment: a, checkin: null, state: "conflict" };
      }
      const c = cs[0] ?? null;
      return { appointment: a, checkin: c, state: c ? checkinState(c.status) : "unverified" };
    });
  return { rows, unresolved: checkins.filter((c) => unresolved.has(c.id)) };
}
