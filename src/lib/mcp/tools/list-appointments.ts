import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { calendarsFor, resolveScope } from "../scope";
import { fetchCrmAppointments } from "../crm";

export default defineTool({
  name: "list_appointments",
  title: "Listar agendamentos (CRM)",
  description:
    "Lista os agendamentos diretamente dos calendários do CRM (HighLevel) num intervalo de datas, com cliente, tatuador, horário e status.",
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
      const calendars = calendarsFor(scope);
      if (calendars.length === 0) {
        return {
          content: [
            { type: "text", text: "Nenhum calendário do CRM disponível para este utilizador." },
          ],
          structuredContent: { fonte: "crm", count: 0, appointments: [] },
        };
      }
      const all = await fetchCrmAppointments(calendars, from, to);
      const rows = all.slice(0, limit ?? 50);
      const payload = {
        fonte: "crm" as const,
        periodo: { from, to },
        count: rows.length,
        total_no_periodo: all.length,
        appointments: rows,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        content: [{ type: "text", text: `Falha ao ler a agenda do CRM: ${message}` }],
        isError: true,
      };
    }
  },
});
