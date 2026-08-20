import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ReportRow } from "@/lib/report-html";
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

// Metadados de origem do pedido (dispositivo + marca anónima do IP).
async function captureRequestTrace(): Promise<{
  userAgent: string | null;
  ipHash: string | null;
}> {
  let userAgent: string | null = null;
  let ip: string | null = null;
  try {
    userAgent = (getRequestHeader("user-agent") ?? null)?.slice(0, 300) ?? null;
    ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-real-ip") ??
      (getRequestHeader("x-forwarded-for") ?? "").split(",")[0].trim() ??
      null;
  } catch {
    // fora de um contexto de request
  }
  let ipHash: string | null = null;
  if (ip) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
    ipHash = Array.from(new Uint8Array(buf))
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return { userAgent, ipHash: ipHash };
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

// ---------------- listRecentClients -------------------------------------

const RecentClientsInput = z.object({
  slug: z.string(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const listRecentClients = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => RecentClientsInput.parse(data))
  .handler(async ({ data }): Promise<string[]> => {
    if (!isMovimentacaoSlug(data.slug)) throw new Error("Link inválido.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("movimentacoes" as never)
      .select("nome_cliente")
      .eq("link_origem", data.slug)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const names = Array.from(
      new Set(
        (rows ?? []).map((r) => (r as { nome_cliente: string }).nome_cliente.trim()),
      ),
    ).filter(Boolean);
    return names.slice(0, data.limit);
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
    registrado_por_id: z.enum([...STAFF_RECEBEDOR_IDS, "outro"] as [string, ...string[]]),
    registrado_por_nome: z.string().trim().max(80).nullable().optional(),
    descricao_projeto: z.string().trim().max(500).nullable().optional(),
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
    message: "Informe a data da tatuagem agendada.",
    path: ["data_tatuagem"],
  })
  .refine((v) => v.registrado_por_id !== "outro" || (v.registrado_por_nome ?? "").length >= 2, {
    message: "Indique quem está a registar.",
    path: ["registrado_por_nome"],
  });

export interface CreateResult {
  id: string;
  ids: string[];
  ghl_sync_status: "pending" | "synced" | "failed";
  ghl_error?: string;
}

async function insertMovimentacaoRows(
  params: {
    nome_cliente: string;
    data_pagamento: string;
    artist_id: string;
    tipo_movimento: MovimentacaoTipo;
    recebido_por_app_user_id: string;
    registrado_por_app_user_id: string | null;
    registrado_por_nome: string | null;
    registrado_por_staff_id: string | null;
    registrado_user_agent: string | null;
    registrado_ip_hash: string | null;
    link_origem: string;
    origem_lancamento: string;
    valor_cartao: number;
    valor_dinheiro: number;
    valor_sumup: number;
    valor_transferencia: number;
    data_tatuagem: string | null;
    observacoes: string | null;
    chave_idempotencia: string;
    artist_name: string;
    recebido_por_nome: string;
    descricao_projeto?: string | null;
  },
): Promise<CreateResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { syncMovimentacaoToGhl } = await import("./movimentacao-ghl.server");

  const forms: Array<{ forma: FormaPagamento; valor: number }> = [
    { forma: "cartao" as const, valor: params.valor_cartao },
    { forma: "dinheiro" as const, valor: params.valor_dinheiro },
    { forma: "sumup" as const, valor: params.valor_sumup },
    { forma: "transferencia" as const, valor: params.valor_transferencia },
  ].filter((f) => f.valor > 0);

  const groupKey = (globalThis.crypto as Crypto | undefined)?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const ids: string[] = [];
  const errors: string[] = [];

  for (const f of forms) {
    const chaveForma = `${params.chave_idempotencia}:${f.forma}`;

    const { data: existing } = await supabaseAdmin
      .from("movimentacoes" as never)
      .select("id")
      .eq("chave_idempotencia", params.chave_idempotencia)
      .eq("forma_pagamento", f.forma)
      .maybeSingle();
    if (existing) {
      ids.push((existing as { id: string }).id);
      continue;
    }

    const insertPayload = {
      nome_cliente: params.nome_cliente.trim(),
      data_pagamento: params.data_pagamento,
      artist_id: params.artist_id,
      recebido_por_app_user_id: params.recebido_por_app_user_id,
      registrado_por_app_user_id: params.registrado_por_app_user_id,
      registrado_por_nome: params.registrado_por_nome,
      registrado_por_staff_id: params.registrado_por_staff_id,
      registrado_user_agent: params.registrado_user_agent,
      registrado_ip_hash: params.registrado_ip_hash,
      registrado_em: new Date().toISOString(),
      link_origem: params.link_origem,
      origem_lancamento: params.origem_lancamento,
      tipo_movimento: params.tipo_movimento,
      forma_pagamento: f.forma,
      valor_cartao: f.forma === "cartao" ? f.valor : 0,
      valor_dinheiro: f.forma === "dinheiro" ? f.valor : 0,
      valor_sumup: f.forma === "sumup" ? f.valor : 0,
      valor_transferencia: f.forma === "transferencia" ? f.valor : 0,
      data_tatuagem: params.data_tatuagem ?? null,
      observacoes: params.observacoes?.trim() || null,
      chave_idempotencia: params.chave_idempotencia,
      chave_grupo: groupKey,
      descricao_projeto: params.descricao_projeto?.trim() || null,
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

    const sync = await syncMovimentacaoToGhl({
      id: row.id,
      chave_idempotencia: chaveForma,
      nome_cliente: params.nome_cliente.trim(),
      data_pagamento: params.data_pagamento,
      artist_name: params.artist_name,
      recebido_por_nome: params.recebido_por_nome,
      link_origem: params.link_origem,
      tipo_movimento: params.tipo_movimento,
      valor_cartao: insertPayload.valor_cartao,
      valor_dinheiro: insertPayload.valor_dinheiro,
      valor_sumup: insertPayload.valor_sumup,
      valor_transferencia: insertPayload.valor_transferencia,
      total: Number(row.total),
      data_tatuagem: params.data_tatuagem ?? null,
      observacoes: params.observacoes?.trim() || null,
      descricao_projeto: params.descricao_projeto?.trim() || null,
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
}

export const createMovimentacao = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CreateInput.parse(data))
  .handler(async ({ data }): Promise<CreateResult> => {
    if (!isMovimentacaoSlug(data.slug)) throw new Error("Link inválido.");
    const slug = data.slug;

    const recebedor = getStaffRecebedor(data.recebido_por_id);
    const registradoStaff =
      data.registrado_por_id === "outro"
        ? null
        : STAFF_RECEBEDORES.find((s) => s.id === data.registrado_por_id) ?? null;
    const registradoNome =
      registradoStaff?.displayName ?? ((data.registrado_por_nome ?? "").trim() || null);
    const trace = await captureRequestTrace();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: artistData, error: artistErr } = await supabaseAdmin
      .from("artists" as never)
      .select("id, name")
      .eq("id", data.artist_id)
      .maybeSingle();
    if (artistErr) throw new Error(artistErr.message);
    const artistRow = artistData as { id: string; name: string } | null;
    if (!artistRow) throw new Error("Tatuador inválido.");

    return insertMovimentacaoRows({
      nome_cliente: data.nome_cliente,
      data_pagamento: data.data_pagamento,
      artist_id: data.artist_id,
      tipo_movimento: data.tipo_movimento,
      recebido_por_app_user_id: recebedor.appUserId,
      registrado_por_app_user_id: null,
      registrado_por_nome: registradoNome,
      registrado_por_staff_id: data.registrado_por_id,
      registrado_user_agent: trace.userAgent,
      registrado_ip_hash: trace.ipHash,
      link_origem: slug,
      origem_lancamento: "link_individual",
      valor_cartao: data.valor_cartao,
      valor_dinheiro: data.valor_dinheiro,
      valor_sumup: data.valor_sumup,
      valor_transferencia: data.valor_transferencia,
      data_tatuagem: data.data_tatuagem ?? null,
      observacoes: data.observacoes ?? null,
      chave_idempotencia: data.chave_idempotencia,
      artist_name: artistRow.name,
      recebido_por_nome: recebedor.displayName,
      descricao_projeto: data.descricao_projeto ?? null,
    });
  });

// ---------------- createMovimentacaoManual --------------------------------

const CreateManualInput = z
  .object({
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
    descricao_projeto: z.string().trim().max(500).nullable().optional(),
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
    message: "Informe a data da tatuagem agendada.",
    path: ["data_tatuagem"],
  });

export const createMovimentacaoManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateManualInput.parse(data))
  .handler(async ({ data, context }): Promise<CreateResult> => {
    const recebedor = getStaffRecebedor(data.recebido_por_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: artistData, error: artistErr } = await supabaseAdmin
      .from("artists" as never)
      .select("id, name")
      .eq("id", data.artist_id)
      .maybeSingle();
    if (artistErr) throw new Error(artistErr.message);
    const artistRow = artistData as { id: string; name: string } | null;
    if (!artistRow) throw new Error("Tatuador inválido.");

    // Nome de quem registou: staff conhecido pelo app_user id, senão o próprio recebedor.
    const registradoStaff =
      STAFF_RECEBEDORES.find((s) => s.appUserId === context.userId) ?? null;
    const trace = await captureRequestTrace();

    return insertMovimentacaoRows({
      nome_cliente: data.nome_cliente,
      data_pagamento: data.data_pagamento,
      artist_id: data.artist_id,
      tipo_movimento: data.tipo_movimento,
      recebido_por_app_user_id: recebedor.appUserId,
      registrado_por_app_user_id: context.userId,
      registrado_por_nome: registradoStaff?.displayName ?? "Admin (app)",
      registrado_por_staff_id: registradoStaff?.id ?? null,
      registrado_user_agent: trace.userAgent,
      registrado_ip_hash: trace.ipHash,
      link_origem: "manual",
      origem_lancamento: "manual",
      valor_cartao: data.valor_cartao,
      valor_dinheiro: data.valor_dinheiro,
      valor_sumup: data.valor_sumup,
      valor_transferencia: data.valor_transferencia,
      data_tatuagem: data.data_tatuagem ?? null,
      observacoes: data.observacoes ?? null,
      chave_idempotencia: data.chave_idempotencia,
      artist_name: artistRow.name,
      recebido_por_nome: recebedor.displayName,
      descricao_projeto: data.descricao_projeto ?? null,
    });
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

// ---------------- Editable dashboard ------------------------------------

export interface MovimentacaoEditRow {
  id: string;
  created_at: string;
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
  deleted_at: string | null;
  canEdit: boolean;
  registrado_por_nome: string | null;
  registrado_em: string | null;
}

// (descricao_projeto incluído abaixo no tipo de edição)


function canEditRow(
  role: string | null,
  userId: string,
  recebidoPorAppUserId: string | null,
): boolean {
  if (role === "admin") return true;
  return !!recebidoPorAppUserId && recebidoPorAppUserId === userId;
}

const IdInput = z.object({ id: z.string().uuid() });

export const getMovimentacaoForEdit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdInput.parse(data))
  .handler(async ({ data, context }): Promise<MovimentacaoEditRow> => {
    const me = await getAppUserRow(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rowRaw, error } = await supabaseAdmin
      .from("movimentacoes" as never)
      .select(
        "id, created_at, nome_cliente, data_pagamento, artist_id, recebido_por_app_user_id, link_origem, tipo_movimento, valor_cartao, valor_dinheiro, valor_sumup, valor_transferencia, total, data_tatuagem, observacoes, ghl_sync_status, deleted_at, registrado_por_nome, registrado_em",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rowRaw) throw new Error("Registo não encontrado.");
    const row = rowRaw as unknown as Omit<
      MovimentacaoEditRow,
      "artist_name" | "recebido_por_nome" | "canEdit"
    >;

    const [{ data: artist }, staffName] = await Promise.all([
      supabaseAdmin
        .from("artists" as never)
        .select("name")
        .eq("id", row.artist_id)
        .maybeSingle(),
      Promise.resolve(
        STAFF_RECEBEDORES.find((s) => s.appUserId === row.recebido_por_app_user_id)
          ?.displayName ?? null,
      ),
    ]);

    return {
      ...row,
      valor_cartao: Number(row.valor_cartao),
      valor_dinheiro: Number(row.valor_dinheiro),
      valor_sumup: Number(row.valor_sumup),
      valor_transferencia: Number(row.valor_transferencia),
      total: Number(row.total),
      artist_name: (artist as { name?: string | null } | null)?.name ?? null,
      recebido_por_nome: staffName,
      canEdit: canEditRow(me.role, context.userId, row.recebido_por_app_user_id),
    };
  });

// ---------------- Histórico de alterações --------------------------------

export interface AuditEntry {
  id: string;
  acao: string;
  actor: string | null;
  created_at: string;
  changes: Array<{ campo: string; de: string; para: string }>;
}

const AUDIT_FIELD_LABELS: Record<string, string> = {
  nome_cliente: "Cliente",
  data_pagamento: "Data do pagamento",
  artist_id: "Tatuador",
  recebido_por_app_user_id: "Recebido por",
  tipo_movimento: "Tipo",
  forma_pagamento: "Forma",
  valor_cartao: "Cartão",
  valor_dinheiro: "Dinheiro",
  valor_sumup: "SumUp",
  valor_transferencia: "Transferência",
  total: "Total",
  data_tatuagem: "Data da tatuagem",
  observacoes: "Observações",
  descricao_projeto: "Descrição do projeto",
  ghl_sync_status: "Sync CRM",
  deleted_at: "Apagado em",
  link_origem: "Link",
  origem_lancamento: "Origem",
};

function formatAuditChanges(
  raw: Record<string, unknown> | null,
): Array<{ campo: string; de: string; para: string }> {
  if (!raw) return [];
  const out: Array<{ campo: string; de: string; para: string }> = [];
  for (const [key, value] of Object.entries(raw)) {
    const campo = AUDIT_FIELD_LABELS[key] ?? key;
    if (value && typeof value === "object" && "de" in (value as object)) {
      const v = value as { de: unknown; para: unknown };
      out.push({ campo, de: String(v.de ?? "—"), para: String(v.para ?? "—") });
    } else {
      out.push({ campo, de: "", para: String(value ?? "—") });
    }
  }
  return out;
}

export const listMovimentacaoAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdInput.parse(data))
  .handler(async ({ data, context }): Promise<AuditEntry[]> => {
    const { data: rows, error } = await context.supabase
      .from("movimentacoes_audit")
      .select("id, acao, actor_app_user_id, actor_nome, changes, created_at")
      .eq("movimentacao_id", data.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const staffById = new Map(STAFF_RECEBEDORES.map((s) => [s.appUserId, s.displayName] as const));
    return ((rows ?? []) as Array<{
      id: string;
      acao: string;
      actor_app_user_id: string | null;
      actor_nome: string | null;
      changes: Record<string, unknown> | null;
      created_at: string;
    }>).map((r) => ({
      id: r.id,
      acao: r.acao,
      actor:
        r.actor_nome ??
        (r.actor_app_user_id ? staffById.get(r.actor_app_user_id) ?? "Utilizador da app" : null),
      created_at: r.created_at,
      changes: formatAuditChanges(r.changes),
    }));
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  nome_cliente: z.string().trim().min(2).max(120),
  artist_id: z.string().uuid(),
  tipo_movimento: z.enum(["sinal", "sessao", "saldo", "produto", "estorno"]),
  valor_cartao: z.number().min(0),
  valor_dinheiro: z.number().min(0),
  valor_sumup: z.number().min(0),
  valor_transferencia: z.number().min(0),
  data_tatuagem: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  descricao_projeto: z.string().trim().max(500).nullable().optional(),
});

export const updateMovimentacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateInput.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (data.valor_cartao > 0 && data.valor_sumup > 0) {
      throw new Error("SumUp e Cartão são métodos exclusivos.");
    }
    const total =
      data.valor_cartao + data.valor_dinheiro + data.valor_sumup + data.valor_transferencia;
    if (total <= 0) throw new Error("O total deve ser superior a €0.");

    const me = await getAppUserRow(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur, error: curErr } = await supabaseAdmin
      .from("movimentacoes" as never)
      .select("recebido_por_app_user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (curErr) throw new Error(curErr.message);
    if (!cur) throw new Error("Registo não encontrado.");
    const recebedor = (cur as { recebido_por_app_user_id: string | null }).recebido_por_app_user_id;
    if (!canEditRow(me.role, context.userId, recebedor)) {
      throw new Error("Sem permissão para editar este registo.");
    }

    // Confirm artist exists.
    const { data: artist, error: artErr } = await supabaseAdmin
      .from("artists" as never)
      .select("id")
      .eq("id", data.artist_id)
      .maybeSingle();
    if (artErr) throw new Error(artErr.message);
    if (!artist) throw new Error("Tatuador inválido.");

    const { error: updErr } = await supabaseAdmin
      .from("movimentacoes" as never)
      .update({
        nome_cliente: data.nome_cliente.trim(),
        artist_id: data.artist_id,
        tipo_movimento: data.tipo_movimento,
        valor_cartao: data.valor_cartao,
        valor_dinheiro: data.valor_dinheiro,
        valor_sumup: data.valor_sumup,
        valor_transferencia: data.valor_transferencia,
        data_tatuagem: data.data_tatuagem ?? null,
        descricao_projeto: data.descricao_projeto?.trim() || null,
        ghl_sync_status: "pending",
      } as never)
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });

export const softDeleteMovimentacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdInput.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const me = await getAppUserRow(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur, error } = await supabaseAdmin
      .from("movimentacoes" as never)
      .select("recebido_por_app_user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cur) throw new Error("Registo não encontrado.");
    const recebedor = (cur as { recebido_por_app_user_id: string | null }).recebido_por_app_user_id;
    if (!canEditRow(me.role, context.userId, recebedor)) {
      throw new Error("Sem permissão para apagar este registo.");
    }
    const { error: delErr } = await supabaseAdmin
      .from("movimentacoes" as never)
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", data.id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });

export const resyncMovimentacaoGhl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdInput.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const me = await getAppUserRow(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rowRaw, error } = await supabaseAdmin
      .from("movimentacoes" as never)
      .select(
        "id, chave_idempotencia, nome_cliente, data_pagamento, artist_id, recebido_por_app_user_id, link_origem, tipo_movimento, valor_cartao, valor_dinheiro, valor_sumup, valor_transferencia, total, data_tatuagem, observacoes, ghl_sync_attempts",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rowRaw) throw new Error("Registo não encontrado.");
    const row = rowRaw as FailedRow;
    if (!canEditRow(me.role, context.userId, row.recebido_por_app_user_id)) {
      throw new Error("Sem permissão para ressincronizar.");
    }

    const { data: artistRaw } = await supabaseAdmin
      .from("artists" as never)
      .select("name")
      .eq("id", row.artist_id)
      .maybeSingle();
    const artistName = (artistRaw as { name?: string } | null)?.name ?? "";
    const staffName =
      STAFF_RECEBEDORES.find((s) => s.appUserId === row.recebido_por_app_user_id)
        ?.displayName ?? "";

    const { syncMovimentacaoToGhl } = await import("./movimentacao-ghl.server");
    const sync = await syncMovimentacaoToGhl({
      id: row.id,
      chave_idempotencia: row.chave_idempotencia,
      nome_cliente: row.nome_cliente,
      data_pagamento: row.data_pagamento,
      artist_name: artistName,
      recebido_por_nome: staffName,
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
    const nowIso = new Date().toISOString();
    if (sync.ok || (sync.error && isDuplicateError(sync.error))) {
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
      return { ok: true };
    }
    await supabaseAdmin
      .from("movimentacoes" as never)
      .update({
        ghl_sync_status: "failed",
        ghl_sync_error: (sync.error ?? "").slice(0, 500),
        ghl_sync_attempts: attempts,
        ghl_last_synced_at: nowIso,
      } as never)
      .eq("id", row.id);
    return { ok: false, error: sync.error };
  });

// ---------------- List authenticated user's editable ids ---------------

const EditableIdsInput = z.object({ ids: z.array(z.string().uuid()).max(50) });

export const getEditableMovimentacaoIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EditableIdsInput.parse(data))
  .handler(async ({ data, context }): Promise<{ ids: string[] }> => {
    if (data.ids.length === 0) return { ids: [] };
    const me = await getAppUserRow(context.supabase, context.userId);
    if (me.role === "admin") return { ids: data.ids };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("movimentacoes" as never)
      .select("id, recebido_por_app_user_id")
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{ id: string; recebido_por_app_user_id: string | null }>;
    return {
      ids: list
        .filter((r) => r.recebido_por_app_user_id === context.userId)
        .map((r) => r.id),
    };
  });

// ---------------- Relatório -----------------------------------------------

const ReportInput = z.object({
  start: z.string(),
  end: z.string(),
  artistId: z.string().uuid().nullable().optional(),
  tipo: z.string().nullable().optional(),
  recebedor: z.string().uuid().nullable().optional(),
  syncStatus: z.enum(["pending", "synced", "failed"]).nullable().optional(),
  origem: z.enum(["link_individual", "manual"]).nullable().optional(),
  registrador: z.string().nullable().optional(),
});


export interface MovimentacaoReportResult {
  rows: ReportRow[];
  role: string | null;
}

export const getMovimentacoesReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ReportInput.parse(data))
  .handler(async ({ data, context }): Promise<MovimentacaoReportResult> => {
    const me = await getAppUserRow(context.supabase, context.userId);
    const { data: rowsRaw, error } = await context.supabase.rpc(
      "get_movimentacoes_report" as never,
      {
        p_start: data.start,
        p_end: data.end,
        p_artist: data.artistId ?? null,
        p_tipo: data.tipo ?? null,
        p_recebedor: data.recebedor ?? null,
        p_sync_status: data.syncStatus ?? null,
        p_origem: data.origem ?? null,
        p_registrador: data.registrador ?? null,
      } as never,
    );
    if (error) throw new Error(error.message);
    const raw = (rowsRaw ?? []) as Array<Record<string, unknown>>;
    const rows: ReportRow[] = raw.map((r) => ({
      id: String(r.id),
      created_at: String(r.created_at),
      data_pagamento: String(r.data_pagamento),
      nome_cliente: String(r.nome_cliente ?? ""),
      artist_id: r.artist_id ? String(r.artist_id) : null,
      tatuador: r.tatuador ? String(r.tatuador) : null,
      recebido_por_app_user_id: r.recebido_por_app_user_id ? String(r.recebido_por_app_user_id) : null,
      recebido_por_nome: r.recebido_por_nome ? String(r.recebido_por_nome) : null,
      registrado_por_nome: r.registrado_por_nome ? String(r.registrado_por_nome) : null,
      link_origem: String(r.link_origem ?? ""),
      tipo_movimento: String(r.tipo_movimento ?? ""),
      valor_cartao: Number(r.valor_cartao ?? 0),
      valor_dinheiro: Number(r.valor_dinheiro ?? 0),
      valor_sumup: Number(r.valor_sumup ?? 0),
      valor_transferencia: Number(r.valor_transferencia ?? 0),
      total: Number(r.total ?? 0),
      ghl_sync_status: (r.ghl_sync_status as ReportRow["ghl_sync_status"]) ?? "pending",
    }));
    return { rows, role: me.role };
  });