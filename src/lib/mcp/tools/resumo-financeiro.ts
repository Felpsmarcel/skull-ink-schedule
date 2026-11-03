import { defineTool } from "@lovable.dev/mcp-js";
import { localDateSchema } from "@/lib/dashboard-period";
import { resolveScope } from "../scope";
import { supabaseForUser } from "../supabase";
export default defineTool({
  name: "resumo_financeiro",
  title: "Resumo financeiro (CRM + pagamentos reais)",
  description:
    "Resumo completo por período Europe/Brussels; oportunidades e pagamentos separados. Artistas recebem somente contagens próprias, sem bruto ou comissão estimada.",
  inputSchema: { from: localDateSchema, to: localDateSchema },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    try {
      const scope = await resolveScope(ctx);
      const { readDashboard } = await import("@/lib/dashboard-read.server");
      const payload = await readDashboard(
        supabaseForUser(ctx),
        { ...scope, role: scope.role === "admin" ? "admin" : "artist" },
        from,
        to,
        ctx.signal,
      );
      return { content: [{ type: "text", text: JSON.stringify(payload) }] };
    } catch {
      return {
        content: [{ type: "text", text: "Leitura financeira indisponível ou não autorizada" }],
        isError: true,
      };
    }
  },
});
