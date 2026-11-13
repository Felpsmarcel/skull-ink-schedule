import { useQueries } from "@tanstack/react-query";
import { LOCATION_ID, type StaffMember } from "@/config/staff";
import { useArtists } from "@/hooks/use-artists";
import { scopedAgendaStaff } from "@/lib/agenda-scope";
import { getEvents, type GhlEvent } from "@/lib/ghl";
import { parseAgendaEventsResponse } from "@/lib/agenda-events-response";

export interface StaffRangeAgenda {
  staff: StaffMember;
  events: GhlEvent[];
  isLoading: boolean;
  error?: string;
}

export interface UseStaffRangeOptions {
  artistId?: string | null;
  enabled?: boolean;
}

/**
 * Fetch GHL events per active artist over a range. No free-slot calls —
 * those are only meaningful in the day view.
 */
export function useStaffRangeAgenda(
  startMs: number,
  endMs: number,
  options: UseStaffRangeOptions = {},
) {
  const enabled = options.enabled ?? true;
  const artistsQuery = useArtists();
  const staffList: StaffMember[] = scopedAgendaStaff(
    artistsQuery.data ?? [],
    options.artistId,
    enabled,
  );

  const queries = useQueries({
    queries: staffList.map((staff) => ({
      queryKey: ["agenda-range", staff.id, startMs, endMs],
      enabled: enabled && !artistsQuery.isLoading,
      queryFn: async () => {
        const res = await getEvents(staff.calendarId, startMs, endMs, LOCATION_ID);
        if (!res.ok) throw new Error(`events ${res.status}`);
        return parseAgendaEventsResponse(res.data, staff.calendarId);
      },
      staleTime: 60_000,
      refetchInterval: 120_000,
      refetchIntervalInBackground: false,
    })),
  });

  const agendas: StaffRangeAgenda[] = staffList.map((staff, i) => {
    const q = queries[i];
    return {
      staff,
      events: q?.data ?? [],
      isLoading: q?.isLoading ?? false,
      error: q?.error instanceof Error ? q.error.message : undefined,
    };
  });

  return {
    agendas,
    isFetching: artistsQuery.isLoading || queries.some((q) => q.isFetching),
    isLoading: enabled && (artistsQuery.isLoading || agendas.some((a) => a.isLoading)),
    hasError: artistsQuery.isError || agendas.some((a) => Boolean(a.error)),
    refetch: () => Promise.all([artistsQuery.refetch(), ...queries.map((q) => q.refetch())]),
  };
}
