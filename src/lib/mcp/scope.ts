import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";

export interface ArtistScopeRow {
  id: string;
  name: string;
  ghl_calendar_id: string | null;
  ghl_user_id: string | null;
  active: boolean;
}

export interface McpScope {
  role: "admin" | "artist" | "seller" | "unknown";
  artistId: string | null;
  /** Tatuadores visíveis ao utilizador (admin = todos; tatuador = só ele). */
  artists: ArtistScopeRow[];
  /** Mapa `ghl_user_id` → nome, para atribuir oportunidades do CRM. */
  artistsByUserId: Map<string, string>;
  /** Quando definido, as consultas ao CRM devem restringir-se a este utilizador. */
  restrictToGhlUserId: string | null;
}

/**
 * Resolve identidade e âmbito a partir da base do app (RLS do utilizador
 * autenticado) — os dados de negócio vêm depois do CRM.
 */
export async function resolveScope(ctx: ToolContext): Promise<McpScope> {
  const supabase = supabaseForUser(ctx);
  const { data: me } = await supabase
    .from("app_users")
    .select("id, role, artist_id, seller_id")
    .maybeSingle();
  const role = ((me as { role?: string } | null)?.role ?? "unknown") as McpScope["role"];
  const artistId = (me as { artist_id?: string | null } | null)?.artist_id ?? null;

  const { data: artistRows, error } = await supabase
    .from("artists")
    .select("id, name, ghl_calendar_id, ghl_user_id, active")
    .order("name");
  if (error) throw new Error(error.message);

  const all = (artistRows ?? []) as unknown as ArtistScopeRow[];
  const artists = role === "artist" && artistId ? all.filter((a) => a.id === artistId) : all;

  const artistsByUserId = new Map<string, string>();
  for (const a of all) if (a.ghl_user_id) artistsByUserId.set(a.ghl_user_id, a.name);

  const own = artistId ? all.find((a) => a.id === artistId) : undefined;
  return {
    role,
    artistId,
    artists,
    artistsByUserId,
    restrictToGhlUserId: role === "artist" ? (own?.ghl_user_id ?? null) : null,
  };
}

export function calendarsFor(scope: McpScope) {
  return scope.artists
    .filter((a) => a.ghl_calendar_id)
    .map((a) => ({ calendarId: a.ghl_calendar_id as string, artistName: a.name }));
}
