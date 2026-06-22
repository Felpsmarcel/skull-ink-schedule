import { useQueries } from "@tanstack/react-query";
import { LOCATION_ID, type StaffMember } from "@/config/staff";
import { useArtists } from "@/hooks/use-artists";
import { getFreeSlots, getEvents, type GhlEvent } from "@/lib/ghl";
import {
  brusselsDayStartMs,
  brusselsDayEndMs,
  brusselsDayKey,
  buildDayGrid,
  extractFreeSlotStarts,
  type GridSlot,
} from "@/lib/agenda-grid";

export interface StaffAgenda {
  staff: StaffMember;
  slots: GridSlot[];
  isLoading: boolean;
  error?: string;
  freeCount: number;
  bookedCount: number;
  debug?: {
    freeStartsCount: number;
    eventsCount: number;
    slotsSample: string;
    eventsSample: string;
  };
}

export function useStaffDayAgenda(date: Date) {
  const dayKey = brusselsDayKey(date);
  const dayStartMs = brusselsDayStartMs(date);
  const dayEndMs = brusselsDayEndMs(date);

  const artistsQuery = useArtists();
  const staffList: StaffMember[] = artistsQuery.data ?? [];

  const queries = useQueries({
    queries: staffList.map((staff) => ({
      queryKey: ["agenda", staff.id, dayKey],
      queryFn: async () => {
        const [slotsRes, eventsRes] = await Promise.allSettled([
          getFreeSlots(staff.calendarId, dayStartMs, dayEndMs),
          getEvents(staff.calendarId, dayStartMs, dayEndMs, LOCATION_ID),
        ]);

        let freeStarts: number[] = [];
        let events: GhlEvent[] = [];
        let errorParts: string[] = [];

        if (slotsRes.status === "fulfilled") {
          if (!slotsRes.value.ok) {
            errorParts.push(
              `free-slots ${slotsRes.value.status}: ${JSON.stringify(slotsRes.value.data)}`,
            );
          } else {
            freeStarts = extractFreeSlotStarts(slotsRes.value.data);
          }
        } else {
          errorParts.push(`free-slots: ${slotsRes.reason?.message ?? slotsRes.reason}`);
        }

        if (eventsRes.status === "fulfilled") {
          if (!eventsRes.value.ok) {
            errorParts.push(
              `events ${eventsRes.value.status}: ${JSON.stringify(eventsRes.value.data)}`,
            );
          } else {
            const data = eventsRes.value.data as { events?: GhlEvent[] };
            events = Array.isArray(data?.events) ? data.events : [];
          }
        } else {
          errorParts.push(`events: ${eventsRes.reason?.message ?? eventsRes.reason}`);
        }

        // Only treat as fatal if BOTH failed (no data to show at all)
        const fatal = freeStarts.length === 0 && events.length === 0 && errorParts.length > 0;
        return {
          freeStarts,
          events,
          error: fatal ? errorParts.join(" | ") : undefined,
          partialError: !fatal && errorParts.length > 0 ? errorParts.join(" | ") : undefined,
          slotsRaw: slotsRes.status === "fulfilled" ? slotsRes.value.data : null,
          eventsRaw: eventsRes.status === "fulfilled" ? eventsRes.value.data : null,
        };
      },
      refetchInterval: 120_000,
      refetchIntervalInBackground: false,
      staleTime: 60_000,
    })),
  });

  const result: StaffAgenda[] = staffList.map((staff, i) => {
    const q = queries[i] as (typeof queries)[number] | undefined;
    if (q.isLoading || !q.data) {
      return {
        staff,
        slots: [],
        isLoading: true,
        freeCount: 0,
        bookedCount: 0,
        error: q.error instanceof Error ? q.error.message : undefined,
      };
    }
    const debug = {
      freeStartsCount: q.data.freeStarts.length,
      eventsCount: q.data.events.length,
      slotsSample: JSON.stringify(q.data.slotsRaw).slice(0, 240),
      eventsSample: JSON.stringify(q.data.eventsRaw).slice(0, 240),
    };
    if (q.data.error) {
      return {
        staff,
        slots: [],
        isLoading: false,
        freeCount: 0,
        bookedCount: 0,
        error: q.data.error,
        debug,
      };
    }
    const slots = buildDayGrid({
      dayStartMs,
      freeSlotStartsMs: q.data.freeStarts,
      events: q.data.events,
    });
    return {
      staff,
      slots,
      isLoading: false,
      error: q.data.partialError,
      freeCount: slots.filter((s) => s.status === "free").length,
      bookedCount: slots.filter((s) => s.status === "booked").length,
      debug,
    };
  });

  return {
    agendas: result,
    dayStartMs,
    dayEndMs,
    isFetching: artistsQuery.isLoading || queries.some((q) => q.isFetching),
  };
}