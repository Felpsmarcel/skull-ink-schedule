import { createFileRoute } from "@tanstack/react-router";

// Private worker endpoint (bearer secret). Not scheduled anywhere; disabled while gates are closed.
export const Route = createFileRoute("/api/public/payment-mirror-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleMirrorRun } = await import("@/lib/payment-mirror-run.server");
        const { readActivationGates } = await import("@/lib/payment-mirror.server");
        return handleMirrorRun(request, {
          gates: readActivationGates(),
          secret: process.env["PAYMENT_MIRROR_CRON_SECRET"],
          liveMode: process.env["PAYMENT_MIRROR_LIVE_MODE"] === "true",
          makeStore: async () => {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { createSupabaseMirrorStore } = await import("@/lib/payment-mirror-store.server");
            return createSupabaseMirrorStore(supabaseAdmin as never);
          },
          makeTransport: async () => {
            const token = process.env["GHL_TOKEN"];
            if (!token) throw new Error("not_configured");
            const { createHttpMirrorTransport } = await import("@/lib/payment-mirror-transport.server");
            return createHttpMirrorTransport({ token });
          },
        });
      },
    },
  },
});
