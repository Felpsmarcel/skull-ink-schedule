import { useQueries } from "@tanstack/react-query";
import { LOCATION_ID, type StaffMember } from "@/config/staff";
import { useArtists } from "@/hooks/use-artists";
import { scopedAgendaStaff } from "@/lib/agenda-scope";
import { getFreeSlots, getEvents, type GhlEvent } from "@/lib/ghl";
import { parseAgendaEventsResponse } from "@/lib/agenda-events-response";
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
  events: GhlEvent[];
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

export interface UseStaffDayAgendaOptions {
  artistId?: string | null;
  enabled?: boolean;
}

export function useStaffDayAgenda(date: Date, options: UseStaffDayAgendaOptions = {}) {
  const dayKey = brusselsDayKey(date);
  const dayStartMs = brusselsDayStartMs(date);
  const dayEndMs = brusselsDayEndMs(date);
  const enabled = options.enabled ?? true;

  const artistsQuery = useArtists();
  const staffList: StaffMember[] = scopedAgendaStaff(
    artistsQuery.data ?? [],
    options.artistId,
    enabled,
  );

  const queries = useQueries({
    queries: staffList.map((staff) => ({
      queryKey: ["agenda", staff.id, dayKey],
      enabled: enabled && !artistsQuery.isLoading,
      queryFn: async () => {
        const [slotsRes, eventsRes] = await Promise.allSettled([
          getFreeSlots(staff.calendarId, dayStartMs, dayEndMs),
          getEvents(staff.calendarId, dayStartMs, dayEndMs, LOCATION_ID),
        ]);

        let freeStarts: number[] = [];
        let events: GhlEvent[] = [];
        const errorParts: string[] = [];

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
            try {
              events = parseAgendaEventsResponse(eventsRes.value.data, staff.calendarId);
            } catch {
              errorParts.push("events: resposta inválida ou vínculo divergente");
            }
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
    const q = queries[i];
    if (!q || q.isLoading || !q.data) {
      return {
        staff,
        slots: [],
        events: [],
        isLoading: !q?.isError,
        freeCount: 0,
        bookedCount: 0,
        error: q?.error instanceof Error ? q.error.message : undefined,
      };
    }
    const debug = {
      freeStartsCount: q.data.freeStarts.length,
      eventsCount: q.data.events.length,
      slotsSample: JSON.stringify(q.data.slotsRaw ?? null).slice(0, 240),
      eventsSample: JSON.stringify(q.data.eventsRaw ?? null).slice(0, 240),
    };
    if (q.data.error) {
      return {
        staff,
        slots: [],
        events: [],
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
      events: q.data.events,
      isLoading: false,
      error: q.data.partialError,
      freeCount: slots.filter((s) => s.status === "free").length,
      bookedCount: new Set(q.data.events.map((event) => event.id)).size,
      debug,
    };
  });

  return {
    agendas: result,
    dayStartMs,
    dayEndMs,
    isFetching: artistsQuery.isLoading || queries.some((q) => q.isFetching),
    isLoading: enabled && (artistsQuery.isLoading || result.some((a) => a.isLoading)),
    hasError: artistsQuery.isError || result.some((a) => Boolean(a.error)),
    refetch: () => Promise.all([artistsQuery.refetch(), ...queries.map((q) => q.refetch())]),
  };
}
