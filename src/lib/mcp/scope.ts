import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";
import { resolveDashboardScope } from "@/lib/dashboard-scope";

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
  const userId = ctx.getUserId();
  if (!userId) throw new Error("Não autenticado");
  return resolveDashboardScope(supabase, userId);
}

export function calendarsFor(scope: McpScope) {
  return scope.artists
    .filter((a) => a.ghl_calendar_id)
    .map((a) => ({ calendarId: a.ghl_calendar_id as string, artistName: a.name }));
}
