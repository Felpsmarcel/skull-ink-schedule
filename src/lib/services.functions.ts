import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ServiceInput = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(60),
  duration_min: z.number().int().min(5).max(600),
  modality: z.enum(["presencial", "consulta_online", "hibrido"]),
  price_eur: z.number().min(0),
  price_max_eur: z.number().min(0).nullable(),
  description: z.string().max(2000).nullable().optional(),
  description_short: z.string().max(200).nullable().optional(),
  sort_order: z.number().int().optional(),
  active: z.boolean().optional(),
}).refine(
  (v) => v.price_max_eur == null || v.price_max_eur >= v.price_eur,
  { message: "price_max_eur deve ser >= price_eur", path: ["price_max_eur"] },
);

async function ensureAdmin(supabase: { rpc: (n: string) => Promise<{ data: unknown; error: { message: string } | null }> }) {
  const { data, error } = await supabase.rpc("current_user_role");
  if (error) throw new Error(error.message);
  if (data !== "admin") throw new Response("Forbidden", { status: 403 });
}

export const createService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ServiceInput.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase as never);
    let payload: Record<string, unknown> = { ...data };
    if (payload.sort_order == null) {
      const { data: maxRow } = await context.supabase
        .from("services" as never)
        .select("sort_order")
        .eq("category", data.category)
        .order("sort_order", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      const max = (maxRow as { sort_order: number | null } | null)?.sort_order ?? 0;
      payload.sort_order = max + 1;
    }
    const { data: row, error } = await context.supabase
      .from("services" as never)
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row as { id: string };
  });

export const updateService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      patch: z.object({
        name: z.string().min(1).max(120).optional(),
        category: z.string().min(1).max(60).optional(),
        duration_min: z.number().int().min(5).max(600).optional(),
        modality: z.enum(["presencial", "consulta_online", "hibrido"]).optional(),
        price_eur: z.number().min(0).optional(),
        price_max_eur: z.number().min(0).nullable().optional(),
        description: z.string().max(2000).nullable().optional(),
        description_short: z.string().max(200).nullable().optional(),
        sort_order: z.number().int().optional(),
        active: z.boolean().optional(),
      }).refine(
        (v) =>
          v.price_max_eur == null ||
          v.price_eur == null ||
          v.price_max_eur >= v.price_eur,
        { message: "price_max_eur deve ser >= price_eur", path: ["price_max_eur"] },
      ),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase as never);
    const { error } = await context.supabase
      .from("services" as never)
      .update(data.patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const toggleServiceActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase as never);
    const { error } = await context.supabase
      .from("services" as never)
      .update({ active: data.active } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listAllServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("services" as never)
      .select("id,name,category,duration_min,modality,price_eur,price_max_eur,description,description_short,sort_order,active")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      name: string;
      category: string;
      duration_min: number;
      modality: "presencial" | "consulta_online" | "hibrido";
      price_eur: number | string;
      price_max_eur: number | string | null;
      description: string | null;
      description_short: string | null;
      sort_order: number | null;
      active: boolean;
    }>;
  });