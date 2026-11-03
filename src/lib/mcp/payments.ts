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
import type { SupabaseClient } from "@supabase/supabase-js";
import { dashboardPeriod } from "@/lib/dashboard-period";

export interface StudioPaymentsSummary extends Record<string, unknown> {
  fonte: "app";
  base: "movimentacoes";
  registos: number | null;
  registos_lidos: number;
  total_recebido_eur: number | null;
  truncado: boolean;
  por_forma_eur: {
    cartao: number | null;
    dinheiro: number | null;
    sumup: number | null;
    transferencia: number | null;
  };
  por_tatuador: Array<{ artist_id: string | null; artist_name: string | null; registos: number; total_eur: number }>;
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
  return fetchStudioPaymentsForClient(
    supabaseForUser(ctx),
    from,
    to,
    artistNamesById,
    restrictToArtistId,
  );
}

export async function fetchStudioPaymentsForClient(
  supabase: SupabaseClient,
  from: string,
  to: string,
  artistNamesById: Map<string, string>,
  restrictToArtistId?: string | null,
  signal?: AbortSignal,
): Promise<StudioPaymentsSummary> {
  dashboardPeriod(from, to);
  const rows: MovimentacaoLite[] = [];
  let complete = false;
  let expected: number | null = null;
  const seen = new Set<string>();
  for (let page = 0; page < 50; page++) {
    let query = supabase
      .from("movimentacoes")
      .select(
        "id,data_pagamento,artist_id,valor_cartao,valor_dinheiro,valor_sumup,valor_transferencia,total,ghl_sync_status",
        { count: "exact" },
      )
      .is("deleted_at", null)
      .gte("data_pagamento", from)
      .lte("data_pagamento", to)
      .order("id")
      .range(page * 500, page * 500 + 499);
    if (restrictToArtistId) query = query.eq("artist_id", restrictToArtistId);
    query = query.abortSignal(signal ?? AbortSignal.timeout(10_000));
    const { data, error, count } = await query;
    if (error || !Array.isArray(data) || count === null || !Number.isSafeInteger(count) || count < 0) break;
    if (expected == null) expected = count;
    else if (count !== expected) break;
    if (data.some(r => typeof r.id !== "string" || !r.id.trim() || seen.has(r.id))) break;
    for (const r of data) { if (seen.has(r.id)) { complete = false; break; } seen.add(r.id); }
    if (seen.size !== rows.length + data.length) break;
    rows.push(
      ...((data ?? []) as MovimentacaoLite[]).filter(
        (r) => !restrictToArtistId || r.artist_id === restrictToArtistId,
      ),
    );
    if (count != null && rows.length === count) {
      complete = true;
      break;
    }
    if ((data ?? []).length < 500) break;
  }
  const money = (v: unknown) => (typeof v === "number" && Number.isFinite(v)) || (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)));
  if (rows.some(r => ![r.total, r.valor_cartao, r.valor_dinheiro, r.valor_sumup, r.valor_transferencia].every(money))) complete = false;
  const forma = { cartao: 0, dinheiro: 0, sumup: 0, transferencia: 0 };
  const byArtist = new Map<string | null, { name: string | null; registos: number; total: number }>();
  let total = 0;
  let synced = 0;
  let pending = 0;
  let failed = 0;

  for (const r of rows) {
    // Invalid money never enters an accumulator as a fabricated zero.
    if (![r.total, r.valor_cartao, r.valor_dinheiro, r.valor_sumup, r.valor_transferencia].every(money)) continue;
    forma.cartao += Number(r.valor_cartao);
    forma.dinheiro += Number(r.valor_dinheiro);
    forma.sumup += Number(r.valor_sumup);
    forma.transferencia += Number(r.valor_transferencia);
    const rowTotal = Number(r.total);
    total += rowTotal;

    const key = r.artist_id;
    const agg = byArtist.get(key) ?? { name: key ? artistNamesById.get(key) ?? null : null, registos: 0, total: 0 };
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
    registos: complete ? rows.length : null,
    registos_lidos: rows.length,
    total_recebido_eur: complete ? round2(total) : null,
    truncado: !complete,
    por_forma_eur: {
      cartao: complete ? round2(forma.cartao) : null,
      dinheiro: complete ? round2(forma.dinheiro) : null,
      sumup: complete ? round2(forma.sumup) : null,
      transferencia: complete ? round2(forma.transferencia) : null,
    },
    por_tatuador: (complete ? [...byArtist.entries()] : [])
      .map(([artist_id, v]) => ({
        artist_id,
        artist_name: v.name,
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
