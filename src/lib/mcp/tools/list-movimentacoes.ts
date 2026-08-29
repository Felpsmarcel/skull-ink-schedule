import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_movimentacoes",
  title: "Listar registos de pagamento",
  description:
    "Lista os registos de pagamento (movimentações) num intervalo de datas, com cliente, tatuador, formas de pagamento e total.",
  inputSchema: {
    from: z.string().describe("Data de pagamento inicial (YYYY-MM-DD)."),
    to: z.string().describe("Data de pagamento final inclusiva (YYYY-MM-DD)."),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de linhas (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("movimentacoes")
      .select(
        "id, data_pagamento, data_tatuagem, nome_cliente, descricao_projeto, tipo_movimento, valor_cartao, valor_dinheiro, valor_sumup, valor_transferencia, total, link_origem, registrado_por_nome, artist_id, artists(name)",
      )
      .is("deleted_at", null)
      .gte("data_pagamento", from)
      .lte("data_pagamento", to)
      .order("data_pagamento", { ascending: false })
      .limit(limit ?? 50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? []).map((r) => {
      const { artists, ...rest } = r as Record<string, unknown> & {
        artists?: { name?: string } | null;
      };
      return { ...rest, artist_name: artists?.name ?? null };
    });
    const total = rows.reduce((sum, r) => sum + Number((r as { total?: number }).total ?? 0), 0);
    return {
      content: [{ type: "text", text: JSON.stringify({ total_eur: total, rows }) }],
      structuredContent: { count: rows.length, total_eur: total, movimentacoes: rows },
    };
  },
});
