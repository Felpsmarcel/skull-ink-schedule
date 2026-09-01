import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { resolveScope } from "../scope";
import { fetchCrmFinance, summarizeCrmFinance } from "../crm";

export default defineTool({
  name: "resumo_financeiro",
  title: "Resumo financeiro (CRM)",
  description:
    "Resume o financeiro tal como está no CRM (HighLevel) num intervalo de datas: total ganho, em aberto e perdido, com quebra por status e por tatuador.",
  inputSchema: {
    from: z.string().describe("Data inicial (YYYY-MM-DD)."),
    to: z.string().describe("Data final inclusiva (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    try {
      const scope = await resolveScope(ctx);
      if (scope.role === "seller") {
        return {
          content: [
            {
              type: "text",
              text: "Os vendedores não têm correspondência no CRM para dados financeiros. Consulta o relatório de lançamentos no aplicativo.",
            },
          ],
          isError: true,
        };
      }
      if (scope.role === "artist" && !scope.restrictToGhlUserId) {
        return {
          content: [
            { type: "text", text: "Este tatuador ainda não está ligado a um utilizador do CRM." },
          ],
          isError: true,
        };
      }
      const { rows, truncated } = await fetchCrmFinance(
        from,
        to,
        scope.artistsByUserId,
        scope.restrictToGhlUserId,
      );
      const summary = summarizeCrmFinance(rows, from, to, truncated);
      return {
        content: [{ type: "text", text: JSON.stringify(summary) }],
        structuredContent: summary,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        content: [{ type: "text", text: `Falha ao ler o financeiro do CRM: ${message}` }],
        isError: true,
      };
    }
  },
});
