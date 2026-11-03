import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dashboardPeriod, localDateSchema } from "@/lib/dashboard-period";
import { calendarsFor, resolveScope } from "../scope";
import { fetchCrmAppointments } from "../crm";

export default defineTool({
  name: "list_appointments",
  title: "Listar agendamentos (CRM)",
  description:
    "Lista os agendamentos diretamente dos calendários do CRM (HighLevel) num intervalo de datas, com cliente, tatuador, horário e status.",
  inputSchema: {
    from: localDateSchema,
    to: localDateSchema,
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
      const result = await fetchCrmAppointments(calendars, from, to, ctx.signal);
      const all = result.rows;
      const rows = all.slice(0, limit ?? 50);
      const payload = {
        fonte: "crm" as const,
        periodo: dashboardPeriod(from, to),
        truncado: result.truncated || all.length > (limit ?? 50),
        parcial: result.partial,
        count: rows.length,
        total_no_periodo: result.partial || result.truncated ? null : all.length,
        appointments: rows,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
      };
    } catch {
      const message = "Indisponível ou não autorizado";
      return {
        content: [{ type: "text", text: `Falha ao ler a agenda do CRM: ${message}` }],
        isError: true,
      };
    }
  },
});
