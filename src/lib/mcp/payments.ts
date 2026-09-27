/**
 * Pagamentos reais registados no estúdio (tabela `movimentacoes`).
 *
 * O token atual do CRM não autoriza `payments/transactions` nem custom
 * objects, por isso o saldo efetivamente recebido é lido da base do app,
 * onde cada movimentação é registada com a forma de pagamento. A leitura
 * corre com o token do utilizador (RLS), e é restringida ao tatuador quando
 * o utilizador é um tatuador.
 */

import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";

export interface StudioPaymentsSummary extends Record<string, unknown> {
  fonte: "app";
  base: "movimentacoes";
  registos: number;
  total_recebido_eur: number;
  por_forma_eur: {
    cartao: number;
    dinheiro: number;
    sumup: number;
    transferencia: number;
  };
  por_tatuador: Array<{ artist_name: string; registos: number; total_eur: number }>;
  sincronizados_no_crm: number;
  pendentes_de_sync: number;
  falhas_de_sync: number;
  nota: string;
}

interface MovimentacaoLite {
  id: string;
  data_pagamento: string;
  artist_id: string | null;
  valor_cartao: number | null;
  valor_dinheiro: number | null;
  valor_sumup: number | null;
  valor_transferencia: number | null;
  total: number | null;
  ghl_sync_status: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Soma os pagamentos registados no intervalo (datas YYYY-MM-DD, inclusivo).
 * `artistNamesById` serve apenas para rotular a quebra por tatuador.
 */
export async function fetchStudioPayments(
  ctx: ToolContext,
  from: string,
  to: string,
  artistNamesById: Map<string, string>,
  restrictToArtistId?: string | null,
): Promise<StudioPaymentsSummary> {
  const supabase = supabaseForUser(ctx);
  let query = supabase
    .from("movimentacoes")
    .select(
      "id, data_pagamento, artist_id, valor_cartao, valor_dinheiro, valor_sumup, valor_transferencia, total, ghl_sync_status",
    )
    .is("deleted_at", null)
    .gte("data_pagamento", from)
    .lte("data_pagamento", to)
    .order("data_pagamento", { ascending: false })
    .limit(2000);
  if (restrictToArtistId) query = query.eq("artist_id", restrictToArtistId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as MovimentacaoLite[];

  const forma = { cartao: 0, dinheiro: 0, sumup: 0, transferencia: 0 };
  const byArtist = new Map<string, { registos: number; total: number }>();
  let total = 0;
  let synced = 0;
  let pending = 0;
  let failed = 0;

  for (const r of rows) {
    forma.cartao += Number(r.valor_cartao ?? 0);
    forma.dinheiro += Number(r.valor_dinheiro ?? 0);
    forma.sumup += Number(r.valor_sumup ?? 0);
    forma.transferencia += Number(r.valor_transferencia ?? 0);
    const rowTotal = Number(r.total ?? 0);
    total += rowTotal;

    const key = r.artist_id ? (artistNamesById.get(r.artist_id) ?? r.artist_id) : "(sem tatuador)";
    const agg = byArtist.get(key) ?? { registos: 0, total: 0 };
    agg.registos += 1;
    agg.total += rowTotal;
    byArtist.set(key, agg);

    if (r.ghl_sync_status === "synced") synced += 1;
    else if (r.ghl_sync_status === "failed") failed += 1;
    else pending += 1;
  }

  return {
    fonte: "app",
    base: "movimentacoes",
    registos: rows.length,
    total_recebido_eur: round2(total),
    por_forma_eur: {
      cartao: round2(forma.cartao),
      dinheiro: round2(forma.dinheiro),
      sumup: round2(forma.sumup),
      transferencia: round2(forma.transferencia),
    },
    por_tatuador: [...byArtist.entries()]
      .map(([artist_name, v]) => ({
        artist_name,
        registos: v.registos,
        total_eur: round2(v.total),
      }))
      .sort((a, b) => b.total_eur - a.total_eur),
    sincronizados_no_crm: synced,
    pendentes_de_sync: pending,
    falhas_de_sync: failed,
    nota: "Pagamentos efetivamente registados no estúdio, por data de pagamento.",
  };
}
