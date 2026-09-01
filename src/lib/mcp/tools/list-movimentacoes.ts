import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { resolveScope } from "../scope";
import { fetchCrmFinance } from "../crm";

export default defineTool({
  name: "list_movimentacoes",
  title: "Listar movimentações financeiras (CRM)",
  description:
    "Lista as movimentações financeiras como o CRM (HighLevel) as registou — oportunidades com valor, status, pipeline e tatuador atribuído — num intervalo de datas.",
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
      const limited = rows.slice(0, limit ?? 50);
      const payload = {
        fonte: "crm" as const,
        base: "oportunidades" as const,
        periodo: { from, to },
        count: limited.length,
        total_no_periodo: rows.length,
        total_eur: rows.reduce((sum, r) => sum + r.valor_eur, 0),
        truncado: truncated,
        movimentacoes: limited,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
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
