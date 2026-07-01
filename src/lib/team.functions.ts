import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InviteInput = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  calendarId: z.string().min(5).max(120),
  ghlUserId: z.string().max(120).nullish(),
  commissionPct: z.number().min(0).max(100).default(40),
  redirectTo: z.string().url(),
});

export type InviteArtistInput = z.infer<typeof InviteInput>;

export interface InviteArtistResult {
  artistId: string;
  userId: string;
  reused: boolean;
}

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role" as never, {
      _user_id: userId,
      _role: "admin",
    } as never);
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: artists, error: aErr } = await supabaseAdmin
      .from("artists" as never)
      .select("id, name, ghl_calendar_id, ghl_user_id, commission_pct, active")
      .order("name");
    if (aErr) throw new Error(aErr.message);

    const { data: users, error: uErr } = await supabaseAdmin
      .from("app_users" as never)
      .select("id, role, artist_id");
    if (uErr) throw new Error(uErr.message);

    const usersByArtist = new Map<string, { id: string; role: string }[]>();
    for (const u of (users ?? []) as Array<{ id: string; role: string; artist_id: string | null }>) {
      if (!u.artist_id) continue;
      const list = usersByArtist.get(u.artist_id) ?? [];
      list.push({ id: u.id, role: u.role });
      usersByArtist.set(u.artist_id, list);
    }

    // Best-effort: enrich with email from auth.users via admin API.
    const userIds = new Set<string>();
    for (const list of usersByArtist.values()) for (const u of list) userIds.add(u.id);
    const emailById = new Map<string, string | null>();
    if (userIds.size > 0) {
      const { data: page } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      for (const u of page?.users ?? []) {
        if (userIds.has(u.id)) emailById.set(u.id, u.email ?? null);
      }
    }

    return {
      artists: (artists ?? []).map((a) => {
        const row = a as {
          id: string;
          name: string;
          ghl_calendar_id: string | null;
          ghl_user_id: string | null;
          commission_pct: number | string | null;
          active: boolean;
        };
        const linked = usersByArtist.get(row.id) ?? [];
        return {
          id: row.id,
          name: row.name,
          calendarId: row.ghl_calendar_id,
          ghlUserId: row.ghl_user_id,
          commissionPct: Number(row.commission_pct ?? 40),
          active: row.active,
          users: linked.map((u) => ({ id: u.id, email: emailById.get(u.id) ?? null })),
        };
      }),
    };
  });

export const inviteArtist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InviteInput.parse(d))
  .handler(async ({ data, context }): Promise<InviteArtistResult> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role" as never, {
      _user_id: userId,
      _role: "admin",
    } as never);
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Upsert artist by calendarId (evita duplicar quando admin re-envia convite).
    let artistId: string;
    const { data: existing } = await supabaseAdmin
      .from("artists" as never)
      .select("id")
      .eq("ghl_calendar_id", data.calendarId)
      .maybeSingle();
    if (existing) {
      artistId = (existing as { id: string }).id;
      await supabaseAdmin
        .from("artists" as never)
        .update({
          name: data.name,
          ghl_user_id: data.ghlUserId ?? null,
          commission_pct: data.commissionPct,
          active: true,
        } as never)
        .eq("id", artistId);
    } else {
      const { data: ins, error: insErr } = await supabaseAdmin
        .from("artists" as never)
        .insert({
          name: data.name,
          ghl_calendar_id: data.calendarId,
          ghl_user_id: data.ghlUserId ?? null,
          commission_pct: data.commissionPct,
          active: true,
        } as never)
        .select("id")
        .single();
      if (insErr || !ins) throw new Error(insErr?.message ?? "Falha ao criar artista");
      artistId = (ins as { id: string }).id;
    }

    // 2. Convite por email. Reutiliza usuário se já existir.
    let invitedUserId: string | null = null;
    let reused = false;
    const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: data.redirectTo,
      data: { pending_artist_id: artistId },
    });
    if (invite.error) {
      // Já cadastrado — buscar id em auth.users e apenas linkar.
      const { data: page } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      const existingUser = page?.users?.find(
        (u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
      );
      if (!existingUser) throw new Error(invite.error.message);
      invitedUserId = existingUser.id;
      reused = true;
    } else {
      invitedUserId = invite.data.user?.id ?? null;
    }
    if (!invitedUserId) throw new Error("Não foi possível resolver o usuário convidado.");

    // 3. Linkar em app_users (idempotente).
    const { error: linkErr } = await supabaseAdmin
      .from("app_users" as never)
      .upsert(
        {
          id: invitedUserId,
          role: "artist",
          artist_id: artistId,
        } as never,
        { onConflict: "id" },
      );
    if (linkErr) throw new Error(linkErr.message);

    return { artistId, userId: invitedUserId, reused };
  });