import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PaymentMirrorStatus {
  state: "preparacao" | "ativo";
  gates: { flag: boolean; scopesVerified: boolean; contractVerified: boolean; workflowsReviewed: boolean; draftHomologated: boolean };
  pendingReasons: Array<{ state: string; reason: string; count: number }>;
}

async function assertAdmin(supabase: { from: (t: string) => unknown }, userId: string) {
  const q = supabase.from("app_users") as { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { role?: string } | null; error: unknown }> } } };
  const { data, error } = await q.select("role").eq("id", userId).maybeSingle();
  if (error || data?.role !== "admin") throw new Error("Forbidden");
}

/** Admin-only. While disabled, returns "preparacao" without touching new tables or GHL. */
export const getPaymentMirrorStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentMirrorStatus> => {
    await assertAdmin(context.supabase as never, context.userId);
    const { readActivationGates } = await import("./payment-mirror.server");
    const { gatesOpen } = await import("./payment-mirror-core");
    const gates = readActivationGates();
    if (!gatesOpen(gates)) return { state: "preparacao", gates, pendingReasons: [] };
    const { data, error } = await context.supabase.rpc("mirror_pending_summary" as never);
    if (error) throw new Error("Falha ao ler pendências");
    const rows = (data ?? []) as Array<{ state: string; reason: string; total: number }>;
    return { state: "ativo", gates, pendingReasons: rows.map((r) => ({ state: r.state, reason: r.reason, count: Number(r.total) })) };
  });

const ConfirmInput = z.object({
  source: z.enum(["payment", "booking_deposit", "movimentacao"]),
  sourceId: z.string().uuid(),
  expectedProjectId: z.string().uuid().optional(),
});

/** Admin confirmation of a real receipt. Disabled → returns without any RPC. Values are derived in SQL. */
export const confirmReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConfirmInput.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; reason?: string; receiptId?: string }> => {
    await assertAdmin(context.supabase as never, context.userId);
    const { readActivationGates } = await import("./payment-mirror.server");
    const { gatesOpen } = await import("./payment-mirror-core");
    if (!gatesOpen(readActivationGates())) return { ok: false, reason: "desligado" };
    const { data: id, error } = await context.supabase.rpc("confirm_receipt" as never, {
      p_source: data.source, p_source_id: data.sourceId, p_expected_project_id: data.expectedProjectId ?? null,
    } as never);
    if (error) {
      const known = ["projeto_divergente", "contato_divergente", "fonte_invalida", "valor_invalido", "projeto_ausente", "contato_ausente", "data_ausente", "conflito_idempotencia", "conflito_mapeamento"];
      return { ok: false, reason: known.find((k) => error.message.includes(k)) ?? "erro" };
    }
    return { ok: true, receiptId: id as unknown as string };
  });
