import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StaffMember } from "@/config/staff";

interface ArtistRow {
  id: string;
  ghl_user_id: string | null;
  ghl_calendar_id: string | null;
  name: string;
  avatar_url: string | null;
  specialties: string[] | null;
  active: boolean;
}

const COLORS = [
  "bg-red-700",
  "bg-blue-700",
  "bg-emerald-700",
  "bg-purple-700",
  "bg-amber-700",
  "bg-cyan-700",
  "bg-pink-700",
  "bg-zinc-600",
];

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

function shortName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

async function fetchArtists(): Promise<StaffMember[]> {
  // generated types don't know `artists` yet — loose cast
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (k: string, v: boolean) => {
          not: (
            k: string,
            op: string,
            v: null,
          ) => {
            order: (
              col: string,
            ) => Promise<{ data: ArtistRow[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
  })
    .from("artists")
    .select("id,ghl_user_id,ghl_calendar_id,name,avatar_url,specialties,active")
    .eq("active", true)
    .not("ghl_calendar_id", "is", null)
    .order("name");

  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return rows.map<StaffMember>((r, i) => ({
    id: r.id,
    name: r.name,
    shortName: shortName(r.name),
    calendarId: r.ghl_calendar_id!,
    userId: r.ghl_user_id ?? undefined,
    initials: initials(r.name),
    color: COLORS[i % COLORS.length],
    avatarUrl: r.avatar_url,
  }));
}

export function useArtists() {
  return useQuery({
    queryKey: ["artists"],
    queryFn: fetchArtists,
    staleTime: 5 * 60_000,
  });
}