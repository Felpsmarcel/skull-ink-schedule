import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { brusselsDayKey } from "@/lib/agenda-grid";
import {
  getDayAppointmentStatuses,
  getRangeAppointmentStatuses,
  type DayAppointmentStatus,
} from "@/lib/agenda-status.functions";
import type { PaymentBucket } from "@/lib/finance.functions";

export function useDayAppointmentStatuses(date: Date, enabled = true) {
  const fetchFn = useServerFn(getDayAppointmentStatuses);
  const dayKey = brusselsDayKey(date);
  const q = useQuery<DayAppointmentStatus[]>({
    queryKey: ["agenda-status", dayKey],
    enabled,
    queryFn: async () => {
      try {
        return await fetchFn({ data: { dateISO: date.toISOString() } });
      } catch (error) {
        console.warn("agenda status unavailable", summarizeError(error));
        return [];
      }
    },
    retry: false,
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });
  const map = new Map<string, PaymentBucket>();
  for (const r of q.data ?? []) map.set(r.ghlAppointmentId, r.bucket);
  return { map, isLoading: q.isLoading, error: q.error };
}

export function useRangeAppointmentStatuses(startMs: number, endMs: number, enabled = true) {
  const fetchFn = useServerFn(getRangeAppointmentStatuses);
  const startISO = new Date(startMs).toISOString();
  const endISO = new Date(endMs).toISOString();
  const q = useQuery<DayAppointmentStatus[]>({
    queryKey: ["agenda-status-range", startISO, endISO],
    enabled,
    queryFn: async () => {
      try {
        return await fetchFn({ data: { startISO, endISO } });
      } catch (error) {
        console.warn("agenda range status unavailable", summarizeError(error));
        return [];
      }
    },
    retry: false,
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });
  const map = new Map<string, PaymentBucket>();
  for (const r of q.data ?? []) map.set(r.ghlAppointmentId, r.bucket);
  return { map, isLoading: q.isLoading, error: q.error };
}

function summarizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("522") || message.includes("Connection timed out")) {
    return "backend timeout while loading payment badges";
  }
  if (message.includes("Invalid token") || message.includes("Unauthorized")) {
    return "session token rejected while loading payment badges";
  }
  return message.slice(0, 180);
}