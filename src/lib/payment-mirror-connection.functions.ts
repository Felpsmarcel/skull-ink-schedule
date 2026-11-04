import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PaymentMirrorConnectionResult } from "./payment-mirror-connection.server";

export type { PaymentMirrorConnectionResult } from "./payment-mirror-connection.server";

/** Explicit admin action. No input, DB writes, mirror gates or financial POSTs. */
export const checkPaymentMirrorConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentMirrorConnectionResult> => {
    let isAdmin = false;
    try {
      const { data: profile, error: profileError } = await context.supabase
        .from("app_users" as never)
        .select("role")
        .eq("id", context.userId)
        .maybeSingle();
      isAdmin = !profileError && (profile as { role?: string } | null)?.role === "admin";
    } catch {
      // Supabase transport failures also fail closed without returning the raw error.
    }
    if (!isAdmin) throw new Error("Forbidden");

    // Read runtime secrets only after the signed user's admin role is established.
    const token = process.env.GHL_TOKEN;
    const { incompletePaymentMirrorConnection, probePaymentMirrorConnection } =
      await import("./payment-mirror-connection.server");
    if (!token?.trim()) return incompletePaymentMirrorConnection(false, "token_ausente");

    let calendarId: string | null = null;
    try {
      const { data: artist, error: artistError } = await context.supabase
        .from("artists" as never)
        .select("ghl_calendar_id")
        .eq("active", true)
        .not("ghl_calendar_id", "is", null)
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (artistError) return incompletePaymentMirrorConnection(true, "consulta_calendario_falhou");
      calendarId = (artist as { ghl_calendar_id?: string | null } | null)?.ghl_calendar_id ?? null;
    } catch {
      return incompletePaymentMirrorConnection(true, "consulta_calendario_falhou");
    }
    return probePaymentMirrorConnection({ token, calendarId });
  });
