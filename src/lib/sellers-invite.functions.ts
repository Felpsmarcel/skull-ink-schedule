import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InviteInput = z.object({
  sellerId: z.string().uuid(),
  email: z.string().email(),
  redirectTo: z.string().url(),
});

const RepairInput = z.object({
  sellerId: z.string().uuid(),
  email: z.string().email(),
});

export interface InviteSellerResult {
  sellerId: string;
  userId: string;
  reused: boolean;
  linkOk: boolean;
  linkError?: string;
}

export interface SellerWithUsers {
  id: string;
  name: string;
  commissionPct: number;
  active: boolean;
  users: Array<{ id: string; email: string | null }>;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findAuthUserByEmail(admin: any, email: string): Promise<{ id: string } | null> {
  const needle = email.toLowerCase();
  for (let page = 1; page <= 3; page++) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 200, page });
    const list: Array<{ id: string; email?: string | null }> = data?.users ?? [];
    const hit = list.find((u) => (u.email ?? "").toLowerCase() === needle);
    if (hit) return { id: hit.id };
    if (list.length < 200) break;
  }
  return null;
}

export const listSellersWithUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SellerWithUsers[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sellers, error: sErr } = await supabaseAdmin
      .from("sellers" as never)
      .select("id, name, commission_pct, active")
      .order("name");
    if (sErr) throw new Error(sErr.message);

    const { data: users, error: uErr } = await supabaseAdmin
      .from("app_users" as never)
      .select("id, seller_id");
    if (uErr) throw new Error(uErr.message);

    const usersBySeller = new Map<string, { id: string }[]>();
    for (const u of (users ?? []) as Array<{ id: string; seller_id: string | null }>) {
      if (!u.seller_id) continue;
      const list = usersBySeller.get(u.seller_id) ?? [];
      list.push({ id: u.id });
      usersBySeller.set(u.seller_id, list);
    }

    const userIds = new Set<string>();
    for (const list of usersBySeller.values()) for (const u of list) userIds.add(u.id);
    const emailById = new Map<string, string | null>();
    if (userIds.size > 0) {
      const { data: page } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      for (const u of page?.users ?? []) {
        if (userIds.has(u.id)) emailById.set(u.id, u.email ?? null);
      }
    }

    return ((sellers ?? []) as Array<{
      id: string;
      name: string;
      commission_pct: number | string;
      active: boolean;
    }>).map((s) => {
      const linked = usersBySeller.get(s.id) ?? [];
      return {
        id: s.id,
        name: s.name,
        commissionPct: Number(s.commission_pct),
        active: s.active,
        users: linked.map((u) => ({ id: u.id, email: emailById.get(u.id) ?? null })),
      };
    });
  });

export const inviteSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InviteInput.parse(d))
  .handler(async ({ data, context }): Promise<InviteSellerResult> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: seller, error: sErr } = await supabaseAdmin
      .from("sellers" as never)
      .select("id, name")
      .eq("id", data.sellerId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!seller) throw new Error("Vendedor não encontrado.");

    let invitedUserId: string | null = null;
    let reused = false;
    const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: data.redirectTo,
      data: { pending_seller_id: data.sellerId },
    });
    if (invite.error) {
      const existing = await findAuthUserByEmail(supabaseAdmin, data.email);
      if (!existing) throw new Error(invite.error.message);
      invitedUserId = existing.id;
      reused = true;
    } else {
      invitedUserId = invite.data.user?.id ?? null;
    }
    if (!invitedUserId) throw new Error("Não foi possível resolver o usuário convidado.");

    const { error: linkErr } = await supabaseAdmin
      .from("app_users" as never)
      .upsert(
        { id: invitedUserId, role: "seller", seller_id: data.sellerId } as never,
        { onConflict: "id" },
      );
    if (linkErr) {
      await supabaseAdmin.from("ghl_sync_failures" as never).insert({
        ghl_event_id: `invite-seller:${invitedUserId}`,
        reason: `invite_link: ${linkErr.message}`,
        payload: { sellerId: data.sellerId, userId: invitedUserId, email: data.email } as never,
      } as never);
      return {
        sellerId: data.sellerId,
        userId: invitedUserId,
        reused,
        linkOk: false,
        linkError: linkErr.message,
      };
    }

    return { sellerId: data.sellerId, userId: invitedUserId, reused, linkOk: true };
  });

export const repairSellerLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RepairInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const user = await findAuthUserByEmail(supabaseAdmin, data.email);
    if (!user) throw new Error("Nenhum usuário no Auth com esse email. Convide primeiro.");
    const { error } = await supabaseAdmin
      .from("app_users" as never)
      .upsert(
        { id: user.id, role: "seller", seller_id: data.sellerId } as never,
        { onConflict: "id" },
      );
    if (error) throw new Error(error.message);
    return { userId: user.id };
  });