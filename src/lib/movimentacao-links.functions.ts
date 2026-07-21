import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MOVIMENTACAO_SLUGS, type MovimentacaoSlug } from "@/config/movimentacao-slugs";

export interface MovimentacaoLinkStatus {
  slug: MovimentacaoSlug;
  kind: "artist" | "seller";
  targetId: string;
  displayName: string;
  exists: boolean;
  active: boolean;
  linkedUsers: Array<{ id: string; email: string | null }>;
  ready: boolean;
  failedSyncCount: number;
}

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_users" as never)
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const role = (data as { role?: string } | null)?.role;
  if (role !== "admin") throw new Error("Forbidden");
}

export const getMovimentacaoLinkStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MovimentacaoLinkStatus[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const slugs = Object.values(MOVIMENTACAO_SLUGS);
    const artistIds = slugs.filter((s) => s.kind === "artist").map((s) => s.artistId);
    const sellerIds = slugs.filter((s) => s.kind === "seller").map((s) => s.sellerId);

    const [artistsRes, sellersRes, artistUsersRes, sellerUsersRes, failedRes] = await Promise.all([
      artistIds.length
        ? supabaseAdmin
            .from("artists" as never)
            .select("id, active")
            .in("id", artistIds)
        : Promise.resolve({ data: [], error: null }),
      sellerIds.length
        ? supabaseAdmin
            .from("sellers" as never)
            .select("id, active")
            .in("id", sellerIds)
        : Promise.resolve({ data: [], error: null }),
      artistIds.length
        ? supabaseAdmin
            .from("app_users" as never)
            .select("id, artist_id")
            .eq("role", "artist")
            .in("artist_id", artistIds)
        : Promise.resolve({ data: [], error: null }),
      sellerIds.length
        ? supabaseAdmin
            .from("app_users" as never)
            .select("id, seller_id")
            .eq("role", "seller")
            .in("seller_id", sellerIds)
        : Promise.resolve({ data: [], error: null }),
      supabaseAdmin
        .from("movimentacoes" as never)
        .select("link_origem")
        .eq("ghl_sync_status", "failed"),
    ]);
    if (artistsRes.error) throw new Error(artistsRes.error.message);
    if (sellersRes.error) throw new Error(sellersRes.error.message);
    if (artistUsersRes.error) throw new Error(artistUsersRes.error.message);
    if (sellerUsersRes.error) throw new Error(sellerUsersRes.error.message);
    if (failedRes.error) throw new Error(failedRes.error.message);

    const failedBySlug = new Map<string, number>();
    for (const r of (failedRes.data ?? []) as Array<{ link_origem: string }>) {
      failedBySlug.set(r.link_origem, (failedBySlug.get(r.link_origem) ?? 0) + 1);
    }

    const artistById = new Map<string, { active: boolean }>();
    for (const a of (artistsRes.data ?? []) as Array<{ id: string; active: boolean }>) {
      artistById.set(a.id, { active: a.active });
    }
    const sellerById = new Map<string, { active: boolean }>();
    for (const s of (sellersRes.data ?? []) as Array<{ id: string; active: boolean }>) {
      sellerById.set(s.id, { active: s.active });
    }

    const usersByArtist = new Map<string, string[]>();
    for (const u of (artistUsersRes.data ?? []) as Array<{ id: string; artist_id: string }>) {
      const list = usersByArtist.get(u.artist_id) ?? [];
      list.push(u.id);
      usersByArtist.set(u.artist_id, list);
    }
    const usersBySeller = new Map<string, string[]>();
    for (const u of (sellerUsersRes.data ?? []) as Array<{ id: string; seller_id: string }>) {
      const list = usersBySeller.get(u.seller_id) ?? [];
      list.push(u.id);
      usersBySeller.set(u.seller_id, list);
    }

    const allUserIds = new Set<string>();
    for (const arr of usersByArtist.values()) for (const id of arr) allUserIds.add(id);
    for (const arr of usersBySeller.values()) for (const id of arr) allUserIds.add(id);
    const emailById = new Map<string, string | null>();
    if (allUserIds.size > 0) {
      const { data: page } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      for (const u of page?.users ?? []) {
        if (allUserIds.has(u.id)) emailById.set(u.id, u.email ?? null);
      }
    }

    return slugs.map((s): MovimentacaoLinkStatus => {
      const targetId = s.kind === "artist" ? s.artistId : s.sellerId;
      const row = s.kind === "artist" ? artistById.get(targetId) : sellerById.get(targetId);
      const userIds = (s.kind === "artist" ? usersByArtist : usersBySeller).get(targetId) ?? [];
      const linkedUsers = userIds.map((id) => ({ id, email: emailById.get(id) ?? null }));
      const exists = !!row;
      const active = !!row?.active;
      return {
        slug: s.slug,
        kind: s.kind,
        targetId,
        displayName: s.displayName,
        exists,
        active,
        linkedUsers,
        ready: exists && active && linkedUsers.length > 0,
        failedSyncCount: failedBySlug.get(s.slug) ?? 0,
      };
    });
  });