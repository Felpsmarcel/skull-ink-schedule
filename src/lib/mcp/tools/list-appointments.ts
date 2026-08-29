import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_appointments",
  title: "Listar agendamentos",
  description:
    "Lista agendamentos da agenda do estúdio num intervalo de datas, com cliente, tatuador, horário e status.",
  inputSchema: {
    from: z.string().describe("Data inicial (YYYY-MM-DD)."),
    to: z.string().describe("Data final inclusiva (YYYY-MM-DD)."),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de linhas (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("appointments")
      .select(
        "id, start_at, end_at, status, contact_name, contact_phone, total_eur, deposit_eur, commission_pct, artist_id, artists(name)",
      )
      .gte("start_at", `${from}T00:00:00Z`)
      .lte("start_at", `${to}T23:59:59Z`)
      .order("start_at", { ascending: true })
      .limit(limit ?? 50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? []).map((r) => {
      const { artists, ...rest } = r as Record<string, unknown> & {
        artists?: { name?: string } | null;
      };
      return { ...rest, artist_name: artists?.name ?? null };
    });
    return {
      content: [{ type: "text", text: JSON.stringify(rows) }],
      structuredContent: { count: rows.length, appointments: rows },
    };
  },
});
