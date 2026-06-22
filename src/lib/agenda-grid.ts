import type { GhlEvent } from "./ghl";

export const SLOT_MINUTES = 30;
export const DEFAULT_START_HOUR = 8;
export const DEFAULT_END_HOUR = 22;

export interface GridSlot {
  /** start time of slot in ms */
  startMs: number;
  /** label "HH:mm" in Europe/Brussels */
  label: string;
  status: "free" | "booked" | "outside";
  contactName?: string;
  serviceName?: string;
}

const TZ = "Europe/Brussels";

const hhmmFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatHHmm(ms: number) {
  return hhmmFmt.format(new Date(ms));
}

/** Hour-of-day (0–23) in Europe/Brussels for a given ms timestamp. */
export function brusselsHour(ms: number): number {
  const [h] = hhmmFmt.format(new Date(ms)).split(":");
  return parseInt(h, 10);
}

/** Minute-of-day in Brussels (0–1439) */
export function brusselsMinuteOfDay(ms: number): number {
  const [h, m] = hhmmFmt.format(new Date(ms)).split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/** Day key YYYY-MM-DD in Brussels */
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function brusselsDayKey(d: Date): string {
  return dayKeyFmt.format(d);
}

/** Brussels offset (ms) at a given instant */
function brusselsOffsetMs(at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(at).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "0" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - at.getTime();
}

/** Start of given calendar date at 00:00 Europe/Brussels → UTC ms */
export function brusselsDayStartMs(date: Date): number {
  const key = brusselsDayKey(date); // "YYYY-MM-DD"
  const [y, m, d] = key.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const off = brusselsOffsetMs(new Date(guess));
  return guess - off;
}

export function brusselsDayEndMs(date: Date): number {
  return brusselsDayStartMs(date) + 24 * 3600 * 1000 - 1;
}

/** Round ms down to nearest SLOT_MINUTES boundary in Brussels day */
function snapDownToSlot(ms: number, dayStartMs: number): number {
  const delta = ms - dayStartMs;
  const slotMs = SLOT_MINUTES * 60 * 1000;
  return dayStartMs + Math.floor(delta / slotMs) * slotMs;
}

function snapUpToSlot(ms: number, dayStartMs: number): number {
  const delta = ms - dayStartMs;
  const slotMs = SLOT_MINUTES * 60 * 1000;
  return dayStartMs + Math.ceil(delta / slotMs) * slotMs;
}

/** Build the per-staff slot list for a day. */
export function buildDayGrid(opts: {
  dayStartMs: number;
  freeSlotStartsMs: number[];
  events: GhlEvent[];
}): GridSlot[] {
  const { dayStartMs, freeSlotStartsMs, events } = opts;

  // Determine grid bounds (dynamic).
  let startMin = DEFAULT_START_HOUR * 60;
  let endMin = DEFAULT_END_HOUR * 60;

  for (const ms of freeSlotStartsMs) {
    const m = brusselsMinuteOfDay(ms);
    if (m < startMin) startMin = Math.floor(m / SLOT_MINUTES) * SLOT_MINUTES;
    if (m + SLOT_MINUTES > endMin) endMin = Math.ceil((m + SLOT_MINUTES) / SLOT_MINUTES) * SLOT_MINUTES;
  }
  for (const ev of events) {
    const sMs = new Date(ev.startTime).getTime();
    const eMs = new Date(ev.endTime).getTime();
    if (!Number.isFinite(sMs) || !Number.isFinite(eMs)) continue;
    const sMin = brusselsMinuteOfDay(sMs);
    const eMin = brusselsMinuteOfDay(eMs);
    if (sMin < startMin) startMin = Math.floor(sMin / SLOT_MINUTES) * SLOT_MINUTES;
    if (eMin > endMin) endMin = Math.ceil(eMin / SLOT_MINUTES) * SLOT_MINUTES;
  }

  // Cache free slot start minutes (snapped) for quick lookup.
  const freeMinutes = new Set<number>();
  for (const ms of freeSlotStartsMs) {
    const snapped = snapDownToSlot(ms, dayStartMs);
    freeMinutes.add(brusselsMinuteOfDay(snapped));
  }

  // Build event ranges in minute-of-day
  const evRanges = events
    .map((ev) => {
      const sMs = new Date(ev.startTime).getTime();
      const eMs = new Date(ev.endTime).getTime();
      if (!Number.isFinite(sMs) || !Number.isFinite(eMs)) return null;
      const startSnap = snapDownToSlot(sMs, dayStartMs);
      const endSnap = snapUpToSlot(eMs, dayStartMs);
      return {
        startMin: brusselsMinuteOfDay(startSnap),
        endMin: brusselsMinuteOfDay(endSnap),
        ev,
      };
    })
    .filter((x): x is { startMin: number; endMin: number; ev: GhlEvent } => x !== null);

  const slots: GridSlot[] = [];
  for (let min = startMin; min < endMin; min += SLOT_MINUTES) {
    const startMs = dayStartMs + min * 60 * 1000;
    const label = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
    const hit = evRanges.find((r) => min >= r.startMin && min < r.endMin);
    if (hit) {
      const ev = hit.ev;
      const contactName =
        ev.contact?.name ||
        [ev.contact?.firstName, ev.contact?.lastName].filter(Boolean).join(" ") ||
        undefined;
      slots.push({
        startMs,
        label,
        status: "booked",
        contactName,
        serviceName: ev.title,
      });
    } else if (freeMinutes.has(min)) {
      slots.push({ startMs, label, status: "free" });
    } else {
      slots.push({ startMs, label, status: "outside" });
    }
  }
  return slots;
}

/** Extract ISO start times from a GHL free-slots response */
export function extractFreeSlotStarts(resp: unknown): number[] {
  if (!resp || typeof resp !== "object") return [];
  const out: number[] = [];

  const pushIso = (s: unknown) => {
    if (typeof s !== "string") return;
    const ms = new Date(s).getTime();
    if (Number.isFinite(ms)) out.push(ms);
  };

  const visit = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        if (typeof item === "string") pushIso(item);
        else visit(item);
      }
      return;
    }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "traceId" || k === "_dates_") continue;
        if (k === "slots" && Array.isArray(v)) {
          for (const s of v) pushIso(s);
          continue;
        }
        visit(v);
      }
    }
  };

  visit(resp);
  return out;
}