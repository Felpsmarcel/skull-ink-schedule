import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MOVIMENTACAO_SLUGS,
  isMovimentacaoSlug,
  type MovimentacaoSlug,
  type SlugTarget,
} from "@/config/movimentacao-slugs";

// ---------------- Types --------------------------------------------------

export type MovimentacaoTipo = "sinal" | "sessao" | "saldo" | "produto" | "estorno";

export interface SlugContext {
  slug: MovimentacaoSlug;
  target: SlugTarget;
  isOwner: boolean;
  isAdmin: boolean;
  recebidoPorAppUserId: string; // dono do slug
  recebidoPorNome: string;
  defaultArtistId: string | null; // pré-seleção do select "Tatuador"
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

async function resolveSlugOwner(
  slug: MovimentacaoSlug,
): Promise<{ appUserId: string; displayName: string; defaultArtistId: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const target = MOVIMENTACAO_SLUGS[slug];

  if (target.kind === "artist") {
    const { data, error } = await supabaseAdmin
      .from("app_users" as never)
      .select("id")
      .eq("artist_id", target.artistId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as { id: string } | null;
    if (!row) {
      throw new Error(
        `Nenhuma conta linkada ao artista ${target.displayName}. Convide-o em /admin/equipe antes de usar este link.`,
      );
    }
    return {
      appUserId: row.id,
      displayName: target.displayName,
      defaultArtistId: target.artistId,
    };
  }

  // seller
  const { data, error } = await supabaseAdmin
    .from("app_users" as never)
    .select("id")
    .eq("seller_id", target.sellerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { id: string } | null;
  if (!row) {
    throw new Error(
      `Nenhuma conta linkada a ${target.displayName}. Convide em /admin/vendedores antes de usar este link.`,
    );
  }
  return { appUserId: row.id, displayName: target.displayName, defaultArtistId: null };
}

// ---------------- getSlugContext ----------------------------------------

const SlugInput = z.object({ slug: z.string() });

export const getSlugContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SlugInput.parse(data))
  .handler(async ({ data, context }): Promise<SlugContext> => {
    const { supabase, userId } = context;
    if (!isMovimentacaoSlug(data.slug)) {
      throw new Error("Link inválido.");
    }
    const slug = data.slug;
    const target = MOVIMENTACAO_SLUGS[slug];

    const me = await getAppUserRow(supabase, userId);
    const isAdmin = me.role === "admin";

    const owner = await resolveSlugOwner(slug);
    const isOwner = owner.appUserId === userId;

    if (!isAdmin && !isOwner) {
      // não autorizado neste slug — mas revelamos o slug correto do usuário
      throw new Error("forbidden_slug");
    }

    return {
      slug,
      target,
      isOwner,
      isAdmin,
      recebidoPorAppUserId: owner.appUserId,
      recebidoPorNome: owner.displayName,
      defaultArtistId: owner.defaultArtistId,
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ArtistOption[]> => {
    const { data, error } = await context.supabase
      .from("artists")
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
  ghl_sync_status: "pending" | "synced" | "failed";
  ghl_error?: string;
}

export const createMovimentacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateInput.parse(data))
  .handler(async ({ data, context }): Promise<CreateResult> => {
    const { userId, supabase } = context;

    if (!isMovimentacaoSlug(data.slug)) throw new Error("Link inválido.");
    const slug = data.slug;

    const me = await getAppUserRow(supabase, userId);
    const isAdmin = me.role === "admin";
    const owner = await resolveSlugOwner(slug);
    if (!isAdmin && owner.appUserId !== userId) {
      throw new Error("forbidden_slug");
    }

    // Verifica que artist_id existe e busca nome.
    const { data: artistData, error: artistErr } = await supabase
      .from("artists")
      .select("id, name")
      .eq("id", data.artist_id)
      .maybeSingle();
    if (artistErr) throw new Error(artistErr.message);
    const artistRow = artistData as { id: string; name: string } | null;
    if (!artistRow) throw new Error("Tatuador inválido.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const insertPayload = {
      nome_cliente: data.nome_cliente.trim(),
      data_pagamento: data.data_pagamento,
      artist_id: data.artist_id,
      recebido_por_app_user_id: owner.appUserId,
      registrado_por_app_user_id: userId,
      link_origem: slug,
      origem_lancamento: "link_individual",
      tipo_movimento: data.tipo_movimento,
      valor_cartao: data.valor_cartao,
      valor_dinheiro: data.valor_dinheiro,
      valor_sumup: data.valor_sumup,
      valor_transferencia: data.valor_transferencia,
      data_tatuagem: data.data_tatuagem ?? null,
      observacoes: data.observacoes?.trim() || null,
      chave_idempotencia: data.chave_idempotencia,
      ghl_sync_status: "pending" as const,
    };

    // Idempotência: se já existir, retorna o registro existente.
    const { data: existing } = await supabaseAdmin
      .from("movimentacoes" as never)
      .select("id, ghl_sync_status")
      .eq("chave_idempotencia", data.chave_idempotencia)
      .maybeSingle();
    if (existing) {
      const e = existing as { id: string; ghl_sync_status: CreateResult["ghl_sync_status"] };
      return { id: e.id, ghl_sync_status: e.ghl_sync_status };
    }

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("movimentacoes" as never)
      .insert(insertPayload as never)
      .select("id, total")
      .single();
    if (insertErr) throw new Error(insertErr.message);
    const row = inserted as { id: string; total: number };

    // Sync GHL best-effort.
    const { syncMovimentacaoToGhl } = await import("./movimentacao-ghl.server");
    const sync = await syncMovimentacaoToGhl({
      id: row.id,
      chave_idempotencia: data.chave_idempotencia,
      nome_cliente: insertPayload.nome_cliente,
      data_pagamento: data.data_pagamento,
      artist_name: artistRow.name,
      recebido_por_nome: owner.displayName,
      link_origem: slug,
      tipo_movimento: data.tipo_movimento,
      valor_cartao: data.valor_cartao,
      valor_dinheiro: data.valor_dinheiro,
      valor_sumup: data.valor_sumup,
      valor_transferencia: data.valor_transferencia,
      total: Number(row.total),
      data_tatuagem: data.data_tatuagem ?? null,
      observacoes: data.observacoes ?? null,
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
      return { id: row.id, ghl_sync_status: "synced" };
    } else {
      await supabaseAdmin
        .from("movimentacoes" as never)
        .update({
          ghl_sync_status: "failed",
          ghl_sync_error: (sync.error ?? "").slice(0, 500),
          ghl_sync_attempts: 1,
        } as never)
        .eq("id", row.id);
      return { id: row.id, ghl_sync_status: "failed", ghl_error: sync.error };
    }
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
        "id, chave_idempotencia, nome_cliente, data_pagamento, artist_id, link_origem, tipo_movimento, valor_cartao, valor_dinheiro, valor_sumup, valor_transferencia, total, data_tatuagem, observacoes, ghl_sync_attempts",
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

    // Cache de owners por slug para evitar múltiplos lookups.
    const ownerCache = new Map<string, Awaited<ReturnType<typeof resolveSlugOwner>>>();
    async function getOwner(slug: string) {
      if (!isMovimentacaoSlug(slug)) return null;
      const cached = ownerCache.get(slug);
      if (cached) return cached;
      const owner = await resolveSlugOwner(slug);
      ownerCache.set(slug, owner);
      return owner;
    }

    const { syncMovimentacaoToGhl } = await import("./movimentacao-ghl.server");

    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];
    const nowIso = new Date().toISOString();

    for (const row of rows) {
      const owner = await getOwner(row.link_origem);
      if (!owner) {
        failed++;
        const msg = `link_origem inválido: ${row.link_origem}`;
        errors.push({ id: row.id, error: msg });
        await supabaseAdmin
          .from("movimentacoes" as never)
          .update({
            ghl_sync_error: msg.slice(0, 500),
            ghl_sync_attempts: (row.ghl_sync_attempts ?? 0) + 1,
            ghl_last_synced_at: nowIso,
          } as never)
          .eq("id", row.id);
        continue;
      }

      const sync = await syncMovimentacaoToGhl({
        id: row.id,
        chave_idempotencia: row.chave_idempotencia,
        nome_cliente: row.nome_cliente,
        data_pagamento: row.data_pagamento,
        artist_name: artistName.get(row.artist_id) ?? "",
        recebido_por_nome: owner.displayName,
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