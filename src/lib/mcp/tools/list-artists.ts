import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_artists",
  title: "Listar tatuadores",
  description: "Lista os tatuadores do estúdio com comissão, status ativo e contactos.",
  inputSchema: {
    only_active: z.boolean().optional().describe("Apenas tatuadores ativos (padrão true)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ only_active }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("artists")
      .select("id, name, email, phone, commission_pct, active, specialties")
      .order("name");
    if (only_active !== false) query = query.eq("active", true);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(rows) }],
      structuredContent: { count: rows.length, artists: rows },
    };
  },
});
