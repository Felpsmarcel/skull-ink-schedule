import type { SupabaseClient } from "@supabase/supabase-js";

export class DashboardError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export interface DashboardArtist {
  id: string;
  name: string;
  ghl_calendar_id: string | null;
  ghl_user_id: string | null;
  active: boolean;
}
export interface DashboardScope {
  role: "admin" | "artist";
  artistId: string | null;
  artists: DashboardArtist[];
  artistsByUserId: Map<string, string>;
  restrictToGhlUserId: string | null;
}
export async function resolveDashboardScope(
  client: SupabaseClient,
  userId: string,
): Promise<DashboardScope> {
  const { data: me, error } = await client
    .from("app_users")
    .select("role,artist_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new DashboardError(403, "Acesso não autorizado");
  if (!me || (me.role !== "admin" && me.role !== "artist"))
    throw new DashboardError(403, "Papel não autorizado");
  if (me.role === "artist" && !me.artist_id) throw new DashboardError(403, "Artista sem vínculo");
  let query = client
    .from("artists")
    .select("id,name,ghl_calendar_id,ghl_user_id,active")
    .order("id");
  if (me.role === "artist") query = query.eq("id", me.artist_id);
  const { data, error: artistError } = await query;
  if (artistError) throw new DashboardError(403, "Vínculo não verificado");
  const artists = ((data ?? []) as DashboardArtist[]).filter(
    (a) => me.role === "admin" || a.id === me.artist_id,
  );
  if (
    me.role === "artist" &&
    (artists.length !== 1 || !artists[0]?.ghl_calendar_id || !artists[0]?.ghl_user_id)
  )
    throw new DashboardError(403, "Artista sem vínculo CRM completo");
  return {
    role: me.role,
    artistId: me.role === "artist" ? me.artist_id : null,
    artists,
    artistsByUserId: new Map(
      artists.flatMap((a) => (a.ghl_user_id ? [[a.ghl_user_id, a.name] as const] : [])),
    ),
    restrictToGhlUserId: me.role === "artist" ? (artists[0]?.ghl_user_id ?? null) : null,
  };
}
