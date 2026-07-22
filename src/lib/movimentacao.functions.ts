import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MOVIMENTACAO_SLUGS,
  isMovimentacaoSlug,
  type MovimentacaoSlug,
  type SlugTarget,
  STAFF_RECEBEDORES,
  STAFF_RECEBEDOR_IDS,
  SLUG_DEFAULT_RECEBEDOR,
  getStaffRecebedor,
  type StaffRecebedor,
  type StaffRecebedorId,
} from "@/config/movimentacao-slugs";

// ---------------- Types --------------------------------------------------

export type MovimentacaoTipo = "sinal" | "sessao" | "saldo" | "produto" | "estorno";
export type FormaPagamento = "cartao" | "dinheiro" | "sumup" | "transferencia";

export interface SlugContext {
  slug: MovimentacaoSlug;
  target: SlugTarget;
  recebidoPorAppUserId: string; // default (do slug)
  recebidoPorNome: string;      // default (do slug)
  defaultArtistId: string | null; // pré-seleção do select "Tatuador"
  recebedores: StaffRecebedor[];
  defaultRecebedorId: StaffRecebedorId;
}

export interface MovimentacaoRow {
  id: string;
  nome_cliente: string;
  data_pagamento: string;
  artist_id: string;
  artist_name: string | null;
  recebido_por_app_user_id: string;
  recebido_por_nome: string | null;
  link_origem: string;
  tipo_movimento: MovimentacaoTipo;
  valor_cartao: number;
  valor_dinheiro: number;
  valor_sumup: number;
  valor_transferencia: number;
  total: number;
  data_tatuagem: string | null;
  observacoes: string | null;
  ghl_sync_status: "pending" | "synced" | "failed";
  created_at: string;
}

// ---------------- Helpers ------------------------------------------------

async function getAppUserRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<{ role: string | null; artist_id: string | null; seller_id: string | null }> {
  const { data, error } = await supabase
    .from("app_users")
    .select("role, artist_id, seller_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (
    (data as { role: string | null; artist_id: string | null; seller_id: string | null } | null) ?? {
      role: null,
      artist_id: null,
      seller_id: null,
    }
  );
}

function resolveSlugDefaults(slug: MovimentacaoSlug): {
  defaultRecebedorId: StaffRecebedorId;
  appUserId: string;
  displayName: string;
  defaultArtistId: string | null;
} {
  const target = MOVIMENTACAO_SLUGS[slug];
  const defaultRecebedorId = SLUG_DEFAULT_RECEBEDOR[slug];
  const staff = getStaffRecebedor(defaultRecebedorId);
  return {
    defaultRecebedorId,
    appUserId: staff.appUserId,
    displayName: staff.displayName,
    defaultArtistId: target.kind === "artist" ? target.artistId : null,
  };
}

// ---------------- getSlugContext ----------------------------------------

const SlugInput = z.object({ slug: z.string() });

export const getSlugContext = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => SlugInput.parse(data))
  .handler(async ({ data }): Promise<SlugContext> => {
    if (!isMovimentacaoSlug(data.slug)) {
      throw new Error("Link inválido.");
    }
    const slug = data.slug;
    const target = MOVIMENTACAO_SLUGS[slug];

    const defaults = resolveSlugDefaults(slug);

    return {
      slug,
      target,
      recebidoPorAppUserId: defaults.appUserId,
      recebidoPorNome: defaults.displayName,
      defaultArtistId: defaults.defaultArtistId,
      recebedores: STAFF_RECEBEDORES,
      defaultRecebedorId: defaults.defaultRecebedorId,
    };
  });

// ---------------- getMySlug ---------------------------------------------

export interface MySlugResult {
  slug: MovimentacaoSlug | null;
  reason?: "no_link";
}

export const getMySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MySlugResult> => {
    const me = await getAppUserRow(context.supabase, context.userId);

    if (me.artist_id) {
      const hit = (Object.values(MOVIMENTACAO_SLUGS) as SlugTarget[]).find(
        (t) => t.kind === "artist" && t.artistId === me.artist_id,
      );
      if (hit) return { slug: hit.slug as MovimentacaoSlug };
    }
    if (me.seller_id) {
      const hit = (Object.values(MOVIMENTACAO_SLUGS) as SlugTarget[]).find(
        (t) => t.kind === "seller" && t.sellerId === me.seller_id,
      );
      if (hit) return { slug: hit.slug as MovimentacaoSlug };
    }
    // admin sem link: cai no primeiro (gabriel) apenas para navegar; UI trata.
    if (me.role === "admin") return { slug: "gabriel" };
    return { slug: null, reason: "no_link" };
  });

// ---------------- listArtistsForSelect ----------------------------------

export interface ArtistOption {
  id: string;
  name: string;
}

// Filtra os 2 calendários "GF TATTOO ..." para não aparecerem no select.
const ARTIST_HIDDEN_NAMES = /gf\s*tattoo/i;

export const listArtistsForSelect = createServerFn({ method: "GET" })
  .handler(async (): Promise<ArtistOption[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("artists" as never)
      .select("id, name, active")
      .eq("active", true)
      .order("name");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ id: string; name: string; active: boolean }>;
    return rows
      .filter((r) => !ARTIST_HIDDEN_NAMES.test(r.name ?? ""))
      .map((r) => ({ id: r.id, name: r.name }));
  });

// ---------------- createMovimentacao ------------------------------------

const CreateInput = z
  .object({
    slug: z.string(),
    nome_cliente: z.string().trim().min(2, "Nome do cliente é obrigatório.").max(120),
    data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    artist_id: z.string().uuid("Selecione o tatuador."),
    tipo_movimento: z.enum(["sinal", "sessao", "saldo", "produto", "estorno"]),
    recebido_por_id: z.enum(STAFF_RECEBEDOR_IDS),
    valor_cartao: z.number().min(0).default(0),
    valor_dinheiro: z.number().min(0).default(0),
    valor_sumup: z.number().min(0).default(0),
    valor_transferencia: z.number().min(0).default(0),
    data_tatuagem: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    observacoes: z.string().max(1000).nullable().optional(),
    chave_idempotencia: z.string().uuid("Chave de idempotência inválida."),
  })
  .refine((v) => !(v.valor_cartao > 0 && v.valor_sumup > 0), {
    message: "SumUp e Cartão são métodos exclusivos.",
    path: ["valor_sumup"],
  })
  .refine(
    (v) => v.valor_cartao + v.valor_dinheiro + v.valor_sumup + v.valor_transferencia > 0,
    { message: "O total deve ser superior a €0.", path: ["valor_dinheiro"] },
  )
  .refine((v) => v.tipo_movimento !== "sinal" || Boolean(v.data_tatuagem), {
    message: "Informe a data da sessão agendada.",
    path: ["data_tatuagem"],
  });

export interface CreateResult {
  id: string;
  ids: string[];
  ghl_sync_status: "pending" | "synced" | "failed";
  ghl_error?: string;
}

export const createMovimentacao = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CreateInput.parse(data))
  .handler(async ({ data }): Promise<CreateResult> => {
    if (!isMovimentacaoSlug(data.slug)) throw new Error("Link inválido.");
    const slug = data.slug;

    const recebedor = getStaffRecebedor(data.recebido_por_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verifica que artist_id existe e busca nome.
    const { data: artistData, error: artistErr } = await supabaseAdmin
      .from("artists" as never)
      .select("id, name")
      .eq("id", data.artist_id)
      .maybeSingle();
    if (artistErr) throw new Error(artistErr.message);
    const artistRow = artistData as { id: string; name: string } | null;
    if (!artistRow) throw new Error("Tatuador inválido.");

    // Desmembra em uma linha por forma de pagamento (>0).
    const forms: Array<{ forma: FormaPagamento; valor: number }> = [
      { forma: "cartao" as const, valor: data.valor_cartao },
      { forma: "dinheiro" as const, valor: data.valor_dinheiro },
      { forma: "sumup" as const, valor: data.valor_sumup },
      { forma: "transferencia" as const, valor: data.valor_transferencia },
    ].filter((f) => f.valor > 0);

    // chave_grupo agrupa linhas do mesmo formulário
    const groupKey = (globalThis.crypto as Crypto | undefined)?.randomUUID?.()
      ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const nome = data.nome_cliente.trim();
    const obs = data.observacoes?.trim() || null;

    const ids: string[] = [];
    const errors: string[] = [];
    const { syncMovimentacaoToGhl } = await import("./movimentacao-ghl.server");

    for (const f of forms) {
      const chaveForma = `${data.chave_idempotencia}:${f.forma}`;

      // Idempotência per (chave_idempotencia, forma_pagamento)
      const { data: existing } = await supabaseAdmin
        .from("movimentacoes" as never)
        .select("id")
        .eq("chave_idempotencia", data.chave_idempotencia)
        .eq("forma_pagamento", f.forma)
        .maybeSingle();
      if (existing) {
        ids.push((existing as { id: string }).id);
        continue;
      }

      const insertPayload = {
        nome_cliente: nome,
        data_pagamento: data.data_pagamento,
        artist_id: data.artist_id,
        recebido_por_app_user_id: recebedor.appUserId,
        registrado_por_app_user_id: null,
        link_origem: slug,
        origem_lancamento: "link_individual",
        tipo_movimento: data.tipo_movimento,
        forma_pagamento: f.forma,
        valor_cartao: f.forma === "cartao" ? f.valor : 0,
        valor_dinheiro: f.forma === "dinheiro" ? f.valor : 0,
        valor_sumup: f.forma === "sumup" ? f.valor : 0,
        valor_transferencia: f.forma === "transferencia" ? f.valor : 0,
        data_tatuagem: data.data_tatuagem ?? null,
        observacoes: obs,
        chave_idempotencia: data.chave_idempotencia,
        chave_grupo: groupKey,
        ghl_sync_status: "pending" as const,
      };

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("movimentacoes" as never)
        .insert(insertPayload as never)
        .select("id, total")
        .single();
      if (insertErr) throw new Error(insertErr.message);
      const row = inserted as { id: string; total: number };
      ids.push(row.id);

      // Sync GHL best-effort — cada forma vira um record separado
      const sync = await syncMovimentacaoToGhl({
        id: row.id,
        chave_idempotencia: chaveForma,
        nome_cliente: nome,
        data_pagamento: data.data_pagamento,
        artist_name: artistRow.name,
        recebido_por_nome: recebedor.displayName,
        link_origem: slug,
        tipo_movimento: data.tipo_movimento,
        valor_cartao: insertPayload.valor_cartao,
        valor_dinheiro: insertPayload.valor_dinheiro,
        valor_sumup: insertPayload.valor_sumup,
        valor_transferencia: insertPayload.valor_transferencia,
        total: Number(row.total),
        data_tatuagem: data.data_tatuagem ?? null,
        observacoes: obs,
      });

      if (sync.ok) {
        await supabaseAdmin
          .from("movimentacoes" as never)
          .update({
            ghl_sync_status: "synced",
            ghl_custom_object_id: sync.ghl_custom_object_id ?? null,
            ghl_last_synced_at: new Date().toISOString(),
            ghl_sync_attempts: 1,
          } as never)
          .eq("id", row.id);
      } else {
        errors.push(sync.error ?? "unknown_error");
        await supabaseAdmin
          .from("movimentacoes" as never)
          .update({
            ghl_sync_status: "failed",
            ghl_sync_error: (sync.error ?? "").slice(0, 500),
            ghl_sync_attempts: 1,
          } as never)
          .eq("id", row.id);
      }
    }

    if (ids.length === 0) throw new Error("Nenhum valor válido informado.");

    return {
      id: ids[0],
      ids,
      ghl_sync_status: errors.length === 0 ? "synced" : "failed",
      ghl_error: errors[0],
    };
  });

// ---------------- listMovimentacoes -------------------------------------

const ListInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export const listMovimentacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListInput.parse(data ?? {}))
  .handler(async ({ data, context }): Promise<MovimentacaoRow[]> => {
    let q = context.supabase
      .from("movimentacoes")
      .select(
        "id, nome_cliente, data_pagamento, artist_id, recebido_por_app_user_id, link_origem, tipo_movimento, valor_cartao, valor_dinheiro, valor_sumup, valor_transferencia, total, data_tatuagem, observacoes, ghl_sync_status, created_at",
      )
      .order("data_pagamento", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.from) q = q.gte("data_pagamento", data.from);
    if (data.to) q = q.lte("data_pagamento", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<Omit<MovimentacaoRow, "artist_name" | "recebido_por_nome">>;
    if (list.length === 0) return [];

    // Enriquecer com nome do artista (RLS ok — public artists.name para autenticados).
    const artistIds = Array.from(new Set(list.map((r) => r.artist_id)));
    const { data: artists } = await context.supabase
      .from("artists")
      .select("id, name")
      .in("id", artistIds);
    const artistName = new Map(
      ((artists ?? []) as Array<{ id: string; name: string }>).map((a) => [a.id, a.name] as const),
    );

    return list.map((r) => ({
      ...r,
      artist_name: artistName.get(r.artist_id) ?? null,
      recebido_por_nome: null,
    })) as MovimentacaoRow[];
  });

// ---------------- reprocessFailedMovimentacoes --------------------------

const ReprocessInput = z.object({
  slug: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export interface ReprocessResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

interface FailedRow {
  id: string;
  chave_idempotencia: string;
  nome_cliente: string;
  data_pagamento: string;
  artist_id: string;
  recebido_por_app_user_id: string | null;
  link_origem: string;
  tipo_movimento: MovimentacaoTipo;
  valor_cartao: number;
  valor_dinheiro: number;
  valor_sumup: number;
  valor_transferencia: number;
  total: number;
  data_tatuagem: string | null;
  observacoes: string | null;
  ghl_sync_attempts: number | null;
}

function isDuplicateError(msg: string): boolean {
  const s = msg.toLowerCase();
  return (
    s.includes("status=409") ||
    s.includes("already exists") ||
    s.includes("duplicate") ||
    s.includes("externalid")
  );
}

export const reprocessFailedMovimentacoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ReprocessInput.parse(data ?? {}))
  .handler(async ({ data, context }): Promise<ReprocessResult> => {
    const { userId, supabase } = context;
    const me = await getAppUserRow(supabase, userId);
    if (me.role !== "admin") throw new Error("Forbidden");

    if (data.slug && !isMovimentacaoSlug(data.slug)) throw new Error("Link inválido.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("movimentacoes" as never)
      .select(
        "id, chave_idempotencia, nome_cliente, data_pagamento, artist_id, recebido_por_app_user_id, link_origem, tipo_movimento, valor_cartao, valor_dinheiro, valor_sumup, valor_transferencia, total, data_tatuagem, observacoes, ghl_sync_attempts",
      )
      .eq("ghl_sync_status", "failed")
      .order("created_at", { ascending: true })
      .limit(data.limit);
    if (data.slug) q = q.eq("link_origem", data.slug);

    const { data: rowsRaw, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (rowsRaw ?? []) as FailedRow[];
    if (rows.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0, errors: [] };
    }

    // Enriquecer com artist_name.
    const artistIds = Array.from(new Set(rows.map((r) => r.artist_id)));
    const { data: artists } = await supabaseAdmin
      .from("artists" as never)
      .select("id, name")
      .in("id", artistIds);
    const artistName = new Map(
      ((artists ?? []) as Array<{ id: string; name: string }>).map(
        (a) => [a.id, a.name] as const,
      ),
    );

    // Resolve displayName do recebedor a partir do staff fixo.
    const staffByUserId = new Map(
      STAFF_RECEBEDORES.map((s) => [s.appUserId, s.displayName] as const),
    );
    function nameFor(appUserId: string | null): string {
      return appUserId ? staffByUserId.get(appUserId) ?? "" : "";
    }

    const { syncMovimentacaoToGhl } = await import("./movimentacao-ghl.server");

    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];
    const nowIso = new Date().toISOString();

    for (const row of rows) {
      const sync = await syncMovimentacaoToGhl({
        id: row.id,
        chave_idempotencia: row.chave_idempotencia,
        nome_cliente: row.nome_cliente,
        data_pagamento: row.data_pagamento,
        artist_name: artistName.get(row.artist_id) ?? "",
        recebido_por_nome: nameFor(row.recebido_por_app_user_id),
        link_origem: row.link_origem,
        tipo_movimento: row.tipo_movimento,
        valor_cartao: Number(row.valor_cartao),
        valor_dinheiro: Number(row.valor_dinheiro),
        valor_sumup: Number(row.valor_sumup),
        valor_transferencia: Number(row.valor_transferencia),
        total: Number(row.total),
        data_tatuagem: row.data_tatuagem,
        observacoes: row.observacoes,
      });

      const attempts = (row.ghl_sync_attempts ?? 0) + 1;
      if (sync.ok) {
        succeeded++;
        await supabaseAdmin
          .from("movimentacoes" as never)
          .update({
            ghl_sync_status: "synced",
            ghl_custom_object_id: sync.ghl_custom_object_id ?? null,
            ghl_last_synced_at: nowIso,
            ghl_sync_attempts: attempts,
            ghl_sync_error: null,
          } as never)
          .eq("id", row.id);
      } else if (sync.error && isDuplicateError(sync.error)) {
        // GHL já tem o record (externalId duplicado) — marcar como synced.
        succeeded++;
        await supabaseAdmin
          .from("movimentacoes" as never)
          .update({
            ghl_sync_status: "synced",
            ghl_last_synced_at: nowIso,
            ghl_sync_attempts: attempts,
            ghl_sync_error: null,
          } as never)
          .eq("id", row.id);
      } else {
        failed++;
        errors.push({ id: row.id, error: sync.error ?? "unknown_error" });
        await supabaseAdmin
          .from("movimentacoes" as never)
          .update({
            ghl_sync_error: (sync.error ?? "").slice(0, 500),
            ghl_sync_attempts: attempts,
            ghl_last_synced_at: nowIso,
          } as never)
          .eq("id", row.id);
      }
    }

    return { processed: rows.length, succeeded, failed, errors };
  });

// ---------------- Público: histórico -------------------------------------

export interface HistoricoRow {
  id: string;
  created_at: string;
  nome_cliente: string;
  tatuador: string | null;
  link_origem: string;
  tipo_movimento: MovimentacaoTipo;
  metodo: string; // "Cartão" | "Dinheiro" | "SumUp" | "Transferência" | "Misto"
  total: number;
  ghl_status: "synced" | "pending";
}

export interface HistoricoPage {
  rows: HistoricoRow[];
  total: number;
  totalValor: number;
  page: number;
  pageSize: number;
}

function deriveMetodo(r: {
  valor_cartao: number;
  valor_dinheiro: number;
  valor_sumup: number;
  valor_transferencia: number;
}): string {
  const parts: string[] = [];
  if (r.valor_cartao > 0) parts.push("Cartão");
  if (r.valor_dinheiro > 0) parts.push("Dinheiro");
  if (r.valor_sumup > 0) parts.push("SumUp");
  if (r.valor_transferencia > 0) parts.push("Transferência");
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0];
  return "Misto";
}

const HistoricoInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(15),
});

export const listMovimentacoesHistorico = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => HistoricoInput.parse(data))
  .handler(async ({ data }): Promise<HistoricoPage> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rowsRaw, error } = await supabaseAdmin.rpc(
      "list_movimentacoes_historico" as never,
      { p_page: data.page, p_page_size: data.pageSize } as never,
    );
    if (error) throw new Error(error.message);
    const rows = (rowsRaw ?? []) as Array<{
      id: string;
      created_at: string;
      nome_cliente: string;
      tatuador: string | null;
      link_origem: string;
      tipo_movimento: MovimentacaoTipo;
      valor_cartao: number | string;
      valor_dinheiro: number | string;
      valor_sumup: number | string;
      valor_transferencia: number | string;
      total: number | string;
      ghl_sync_status: "pending" | "synced" | "failed";
      total_count: number | string;
      total_valor: number | string;
    }>;
    const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
    const totalValor = rows.length > 0 ? Number(rows[0].total_valor) : 0;
    const mapped: HistoricoRow[] = rows.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      nome_cliente: r.nome_cliente,
      tatuador: r.tatuador,
      link_origem: r.link_origem,
      tipo_movimento: r.tipo_movimento,
      metodo: deriveMetodo({
        valor_cartao: Number(r.valor_cartao),
        valor_dinheiro: Number(r.valor_dinheiro),
        valor_sumup: Number(r.valor_sumup),
        valor_transferencia: Number(r.valor_transferencia),
      }),
      total: Number(r.total ?? 0),
      ghl_status: r.ghl_sync_status === "synced" ? "synced" : "pending",
    }));
    return {
      rows: mapped,
      total: totalCount,
      totalValor,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

const FindPageInput = z.object({
  id: z.string().uuid(),
  pageSize: z.number().int().min(1).max(50).default(15),
});

export const findMovimentacaoPage = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => FindPageInput.parse(data))
  .handler(async ({ data }): Promise<{ page: number } | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pageNum, error } = await supabaseAdmin.rpc(
      "find_movimentacao_page" as never,
      { p_id: data.id, p_page_size: data.pageSize } as never,
    );
    if (error) throw new Error(error.message);
    if (pageNum == null) return null;
    return { page: Number(pageNum) };
  });