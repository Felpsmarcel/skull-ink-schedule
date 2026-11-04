import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PaymentMirrorStatus {
  state: "preparacao" | "ativo";
  gates: { flag: boolean; scopesVerified: boolean; contractVerified: boolean; workflowsReviewed: boolean };
  pendingReasons: Array<{ reason: string; count: number }>;
}

/** Admin-only. While disabled, returns "preparacao" without touching new tables or GHL. */
export const getPaymentMirrorStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentMirrorStatus> => {
    const { data, error } = await context.supabase.from("app_users").select("role").eq("id", context.userId).maybeSingle();
    if (error || data?.role !== "admin") throw new Error("Forbidden");
    const { readActivationGates } = await import("./payment-mirror.server");
    const { gatesOpen } = await import("./payment-mirror-core");
    const gates = readActivationGates();
    if (!gatesOpen(gates)) return { state: "preparacao", gates, pendingReasons: [] };
    // Activation path intentionally not wired until the reviewed SQL is applied.
    return { state: "preparacao", gates, pendingReasons: [] };
  });
