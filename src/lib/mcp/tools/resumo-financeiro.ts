import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

interface MovRow {
  artist_id: string;
  total: number | null;
  valor_cartao: number;
  valor_dinheiro: number;
  valor_sumup: number;
  valor_transferencia: number;
  artists?: { name?: string } | null;
}

export default defineTool({
  name: "resumo_financeiro",
  title: "Resumo financeiro",
  description:
    "Resume os pagamentos registados num intervalo de datas: total geral, total por forma de pagamento e total por tatuador.",
  inputSchema: {
    from: z.string().describe("Data de pagamento inicial (YYYY-MM-DD)."),
    to: z.string().describe("Data de pagamento final inclusiva (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("movimentacoes")
      .select(
        "artist_id, total, valor_cartao, valor_dinheiro, valor_sumup, valor_transferencia, artists(name)",
      )
      .is("deleted_at", null)
      .gte("data_pagamento", from)
      .lte("data_pagamento", to)
      .limit(5000);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = (data ?? []) as unknown as MovRow[];
    const formas = { cartao: 0, dinheiro: 0, sumup: 0, transferencia: 0 };
    const porTatuador = new Map<string, number>();
    let total = 0;
    for (const r of rows) {
      formas.cartao += Number(r.valor_cartao ?? 0);
      formas.dinheiro += Number(r.valor_dinheiro ?? 0);
      formas.sumup += Number(r.valor_sumup ?? 0);
      formas.transferencia += Number(r.valor_transferencia ?? 0);
      const t = Number(r.total ?? 0);
      total += t;
      const name = r.artists?.name ?? r.artist_id;
      porTatuador.set(name, (porTatuador.get(name) ?? 0) + t);
    }
    const summary = {
      periodo: { from, to },
      registos: rows.length,
      total_eur: total,
      por_forma: formas,
      por_tatuador: [...porTatuador.entries()]
        .map(([artist_name, total_eur]) => ({ artist_name, total_eur }))
        .sort((a, b) => b.total_eur - a.total_eur),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: summary,
    };
  },
});
