import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UpsertArtistInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).nullish(),
  calendarId: z.string().trim().max(120).nullish(),
  ghlUserId: z.string().trim().max(120).nullish(),
  commissionPct: z.number().min(0).max(100).default(40),
  active: z.boolean().default(true),
});

const InviteInput = z.object({
  artistId: z.string().uuid(),
  email: z.string().email(),
  redirectTo: z.string().url().optional(),
});

const RepairInput = z.object({
  artistId: z.string().uuid(),
  email: z.string().email(),
});

export interface InviteArtistResult {
  artistId: string;
  userId: string;
  reused: boolean;
  linkOk: boolean;
  linkError?: string;
}

async function assertAdmin(_supabase: unknown, userId: string) {
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

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: artists, error: aErr } = await supabaseAdmin
      .from("artists" as never)
      .select("id, name, phone, ghl_calendar_id, ghl_user_id, commission_pct, active")
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
          phone: string | null;
          ghl_calendar_id: string | null;
          ghl_user_id: string | null;
          commission_pct: number | string | null;
          active: boolean;
        };
        const linked = usersByArtist.get(row.id) ?? [];
        return {
          id: row.id,
          name: row.name,
          phone: row.phone,
          calendarId: row.ghl_calendar_id,
          ghlUserId: row.ghl_user_id,
          commissionPct: Number(row.commission_pct ?? 40),
          active: row.active,
          users: linked.map((u) => ({ id: u.id, email: emailById.get(u.id) ?? null })),
        };
      }),
    };
  });

export const upsertArtist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertArtistInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.active && (!data.calendarId || data.calendarId.length < 5)) {
      throw new Error("Artista ativo precisa de um GHL calendar ID válido.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      name: data.name,
      phone: data.phone ?? null,
      ghl_calendar_id: data.calendarId ?? null,
      ghl_user_id: data.ghlUserId ?? null,
      commission_pct: data.commissionPct,
      active: data.active,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("artists" as never)
        .update(row as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("artists" as never)
      .insert(row as never)
      .select("id")
      .single();
    if (error || !ins) throw new Error(error?.message ?? "Falha ao criar artista");
    return { id: (ins as { id: string }).id };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findAuthUserByEmail(admin: any, email: string): Promise<{ id: string; email: string | null } | null> {
  const needle = email.toLowerCase();
  for (let page = 1; page <= 3; page++) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 200, page });
    const list: Array<{ id: string; email?: string | null }> = data?.users ?? [];
    const hit = list.find((u) => (u.email ?? "").toLowerCase() === needle);
    if (hit) return { id: hit.id, email: hit.email ?? null };
    if (list.length < 200) break;
  }
  return null;
}

// Hardcoded para blindar contra chamadas feitas do preview do editor
// (window.location.origin cairia em id-preview--*.lovable.app e o link
// do email levaria o tatuador para o site institucional da Lovable).
// Se um dia trocar de domínio, alterar aqui.
const PROD_ORIGIN = "https://gftattoocalendar.com";
const INVITE_REDIRECT_TO = `${PROD_ORIGIN}/auth/update-password`;

export const inviteArtist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InviteInput.parse(d))
  .handler(async ({ data, context }): Promise<InviteArtistResult> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Confirma que o artista existe.
    const { data: artist, error: aErr } = await supabaseAdmin
      .from("artists" as never)
      .select("id")
      .eq("id", data.artistId)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!artist) throw new Error("Artista não encontrado.");

    let invitedUserId: string | null = null;
    let reused = false;
    let actionUrl: string | null = null;
    const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: INVITE_REDIRECT_TO,
      data: { pending_artist_id: data.artistId },
    });
    if (invite.error) {
      const existingUser = await findAuthUserByEmail(supabaseAdmin, data.email);
      if (!existingUser) throw new Error(invite.error.message);
      invitedUserId = existingUser.id;
      reused = true;
      // Usuário já existe → gera um magic link de recovery para ele
      // redefinir/recuperar a senha e cair na tela de update-password.
      try {
        const linkRes = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: data.email,
          options: { redirectTo: INVITE_REDIRECT_TO },
        });
        actionUrl = linkRes.data?.properties?.action_link ?? null;
      } catch (linkErr) {
        console.error("[inviteArtist] generateLink failed", linkErr);
      }
    } else {
      invitedUserId = invite.data.user?.id ?? null;
      // Para novos convites, também geramos um link paralelo para incluir
      // no email branded (o email nativo do Supabase segue chegando).
      try {
        const linkRes = await supabaseAdmin.auth.admin.generateLink({
          type: "invite",
          email: data.email,
          options: { redirectTo: INVITE_REDIRECT_TO },
        });
        actionUrl = linkRes.data?.properties?.action_link ?? null;
      } catch (linkErr) {
        console.error("[inviteArtist] generateLink failed", linkErr);
      }
    }
    if (!invitedUserId) throw new Error("Não foi possível resolver o usuário convidado.");

    const { error: linkErr } = await supabaseAdmin
      .from("app_users" as never)
      .upsert(
        { id: invitedUserId, role: "artist", artist_id: data.artistId } as never,
        { onConflict: "id" },
      );
    if (linkErr) {
      // Log estruturado — reusa ghl_sync_failures como buffer de auditoria.
      await supabaseAdmin.from("ghl_sync_failures" as never).insert({
        ghl_event_id: `invite:${invitedUserId}`,
        reason: `invite_link: ${linkErr.message}`,
        payload: { artistId: data.artistId, userId: invitedUserId, email: data.email } as never,
      } as never);
      return {
        artistId: data.artistId,
        userId: invitedUserId,
        reused,
        linkOk: false,
        linkError: linkErr.message,
      };
    }

    // Boas-vindas branded (extra ao invite auth email). Falhas não abortam o convite.
    // Quando temos actionUrl (link de invite/recovery), ele vira o CTA principal
    // e cada reenvio gera um novo email (message_id inclui timestamp).
    try {
      const { data: artistRow } = await supabaseAdmin
        .from("artists" as never)
        .select("name")
        .eq("id", data.artistId)
        .maybeSingle();
      const artistName = (artistRow as { name?: string } | null)?.name ?? null;

      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      // Se temos actionUrl (fluxo com link), permitir reenvio; se é apenas
      // o boas-vindas puro (sem link), manter idempotência para não spammar.
      const messageId = actionUrl
        ? `team-welcome-${invitedUserId}-${Date.now()}`
        : `team-welcome-${invitedUserId}`;
      const existing = actionUrl
        ? { data: null }
        : await supabaseAdmin
            .from("email_send_log" as never)
            .select("id")
            .eq("message_id", messageId)
            .limit(1)
            .maybeSingle();
      if (!existing.data) {
        const props: { artistName: string | null; agendaUrl: string; inviteUrl?: string } = {
          artistName,
          agendaUrl: `${PROD_ORIGIN}/agenda`,
        };
        if (actionUrl) props.inviteUrl = actionUrl;

        const logRow = async (status: string, errorMessage?: string) => {
          const { error: logErr } = await supabaseAdmin
            .from("email_send_log" as never)
            .insert({
              message_id: messageId,
              template_name: "team-welcome",
              recipient_email: data.email,
              status,
              ...(errorMessage ? { error_message: errorMessage } : {}),
            } as never);
          if (logErr) console.error("[inviteArtist] log write failed", logErr.message);
        };

        try {
          const result = await sendTemplateEmail("team-welcome", data.email, {
            idempotencyKey: messageId,
            templateData: props,
          });
          await logRow(result.sent ? "sent" : "suppressed");
        } catch (sendErr) {
          await logRow("failed", sendErr instanceof Error ? sendErr.message : "unknown");
          throw sendErr;
        }
      }

    } catch (welcomeErr) {
      console.error("[inviteArtist] team-welcome email failed", welcomeErr);
    }

    return { artistId: data.artistId, userId: invitedUserId, reused, linkOk: true };
  });

export const repairArtistLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RepairInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await findAuthUserByEmail(supabaseAdmin, data.email);
    if (!user) throw new Error("Nenhum usuário no Auth com esse email. Convide primeiro.");
    const { error } = await supabaseAdmin
      .from("app_users" as never)
      .upsert(
        { id: user.id, role: "artist", artist_id: data.artistId } as never,
        { onConflict: "id" },
      );
    if (error) throw new Error(error.message);
    return { userId: user.id };
  });