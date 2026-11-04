// Hook called after real receipts are recorded (agenda payment, booking deposit, manual movimentação).
// Gates closed → no-op: no DB read, no RPC, current behavior preserved.
// Gates open → only when the authenticated actor is admin, confirms through confirm_receipt with the
// USER's client (auth.uid() is the actor; values derived in SQL). Never throws into the caller.
import type { ActivationGates } from "./payment-mirror-core";
import { gatesOpen } from "./payment-mirror-core";

export type HookSource = "payment" | "booking_deposit" | "movimentacao";
export interface UserRpc { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> }

export interface HookResult { attempted: number; confirmed: number; skipped: "desligado" | "nao_admin" | null; errors: number }

export async function afterReceiptRecorded(
  client: UserRpc, refs: Array<{ source: HookSource; id: string }>, gates: ActivationGates,
): Promise<HookResult> {
  const out: HookResult = { attempted: 0, confirmed: 0, skipped: null, errors: 0 };
  if (!gatesOpen(gates)) { out.skipped = "desligado"; return out; }
  try {
    const { data: role, error } = await client.rpc("current_user_role");
    if (error || role !== "admin") { out.skipped = "nao_admin"; return out; } // stays "informado"
    for (const r of refs) {
      out.attempted++;
      const { error: e } = await client.rpc("confirm_receipt", { p_source: r.source, p_source_id: r.id });
      if (e) out.errors++; else out.confirmed++; // stays pending for manual confirmation in Configurações
    }
  } catch { out.errors++; }
  return out;
}

export async function runReceiptHook(client: unknown, refs: Array<{ source: HookSource; id: string }>): Promise<void> {
  const { readActivationGates } = await import("./payment-mirror.server");
  await afterReceiptRecorded(client as UserRpc, refs, readActivationGates());
}
