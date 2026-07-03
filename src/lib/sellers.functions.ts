import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface Seller {
  id: string;
  name: string;
  commissionPct: number;
  active: boolean;
}

async function assertAdmin(supabase: any, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("app_users" as never)
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const role = (data as { role?: string } | null)?.role;
  if (role !== "admin") throw new Error("Forbidden: apenas admin");
}

export const listSellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ includeInactive: z.boolean().optional() }).default({}).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<Seller[]> => {
    const { supabase } = context;
    let query = (supabase as any)
      .from("sellers" as never)
      .select("id, name, commission_pct, active")
      .order("name", { ascending: true });
    if (!data.includeInactive) query = query.eq("active", true);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Array<{
      id: string;
      name: string;
      commission_pct: number | string;
      active: boolean;
    }>).map((r) => ({
      id: r.id,
      name: r.name,
      commissionPct: Number(r.commission_pct),
      active: r.active,
    }));
  });

const CreateSellerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  commissionPct: z.number().min(0).max(100).default(0),
  active: z.boolean().default(true),
});

export const createSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateSellerSchema.parse(input))
  .handler(async ({ data, context }): Promise<Seller> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: ins, error } = await (supabase as any)
      .from("sellers" as never)
      .insert({
        name: data.name,
        commission_pct: data.commissionPct,
        active: data.active,
      } as never)
      .select("id, name, commission_pct, active")
      .single();
    if (error || !ins) throw new Error(error?.message ?? "Falha ao criar vendedor");
    const r = ins as { id: string; name: string; commission_pct: number | string; active: boolean };
    return { id: r.id, name: r.name, commissionPct: Number(r.commission_pct), active: r.active };
  });

const UpdateSellerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  commissionPct: z.number().min(0).max(100).optional(),
  active: z.boolean().optional(),
});

export const updateSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateSellerSchema.parse(input))
  .handler(async ({ data, context }): Promise<Seller> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.commissionPct !== undefined) patch.commission_pct = data.commissionPct;
    if (data.active !== undefined) patch.active = data.active;
    const { data: upd, error } = await (supabase as any)
      .from("sellers" as never)
      .update(patch as never)
      .eq("id", data.id)
      .select("id, name, commission_pct, active")
      .single();
    if (error || !upd) throw new Error(error?.message ?? "Falha ao atualizar vendedor");
    const r = upd as { id: string; name: string; commission_pct: number | string; active: boolean };
    return { id: r.id, name: r.name, commissionPct: Number(r.commission_pct), active: r.active };
  });

export const deleteSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    // Soft-delete: mark as inactive. Preserva histórico e vínculos em appointments.
    const { error } = await (supabase as any)
      .from("sellers" as never)
      .update({ active: false } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });