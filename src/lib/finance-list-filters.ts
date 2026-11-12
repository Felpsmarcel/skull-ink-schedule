import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { PaymentBucket } from "@/lib/finance.functions";

export type FinanceListPeriod = "today" | "week" | "month" | "all";
const STUDIO_TIMEZONE = "Europe/Brussels";

/** Half-open civil periods for the displayed appointment list; never changes amounts. */
export function financePeriodBounds(period: FinanceListPeriod, now = new Date()) {
  if (period === "all") return null;
  const day = formatInTimeZone(now, STUDIO_TIMEZONE, "yyyy-MM-dd");
  const start = new Date(`${day}T12:00:00Z`);
  if (period === "week") start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  if (period === "month") start.setUTCDate(1);
  const end = new Date(start);
  if (period === "month") end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCDate(end.getUTCDate() + (period === "week" ? 7 : 1));
  const midnight = (date: Date) =>
    fromZonedTime(`${date.toISOString().slice(0, 10)}T00:00:00`, STUDIO_TIMEZONE).getTime();
  return { from: midnight(start), to: midnight(end) };
}

export function filterFinanceRows<
  T extends {
    startAt: string;
    bucket: PaymentBucket;
    artistId?: string;
    sellerId?: string | null;
  },
>(
  rows: T[],
  period: FinanceListPeriod,
  bucket: "all" | PaymentBucket,
  artistId: string,
  sellerId: string,
  now = new Date(),
): T[] {
  const bounds = financePeriodBounds(period, now);
  return rows.filter((row) => {
    if (bucket !== "all" && row.bucket !== bucket) return false;
    if (bounds) {
      const start = Date.parse(row.startAt);
      if (!Number.isFinite(start) || start < bounds.from || start >= bounds.to) return false;
    }
    if (artistId !== "all" && row.artistId !== artistId) return false;
    if (sellerId !== "all") {
      if (sellerId === "none") {
        if (row.sellerId) return false;
      } else if (row.sellerId !== sellerId) return false;
    }
    return true;
  });
}
