import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { resolveScope } from "../scope";

export default defineTool({
  name: "list_artists",
  title: "Listar tatuadores",
  description: "Lista somente os tatuadores autorizados, nome e status ativo.",
  inputSchema: {
    only_active: z.boolean().optional().describe("Apenas tatuadores ativos (padrão true)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ only_active }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    let scope;
    try {
      scope = await resolveScope(ctx);
    } catch {
      return { content: [{ type: "text", text: "Acesso não autorizado" }], isError: true };
    }
    const rows = scope.artists
      .filter((a) => only_active === false || a.active)
      .map((a) => ({ id: a.id, name: a.name, active: a.active }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows) }],
      structuredContent: { count: rows.length, artists: rows },
    };
  },
});
