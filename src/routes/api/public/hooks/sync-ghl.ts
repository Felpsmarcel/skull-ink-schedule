import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint (called by pg_cron via pg_net).
//
// Auth model: this route lives under /api/public/*, which Lovable's edge
// bypasses. We authenticate the caller with the standard `apikey` header
// matching the project's publishable/anon key — this is the pattern
// documented by Lovable for pg_cron + TanStack server routes, and it is
// what the schedule migration installs. We deliberately do NOT add a
// separate CRON_SECRET because:
//   1. `/api/public/*` already bypasses edge auth; a second header adds
//      no meaningful defense.
//   2. Rotating a bespoke secret across the cron.job body and this route
//      is error-prone.
//   3. The anon key is already known to the sandbox and to pg_cron via
//      Supabase Vault; comparing it here is sufficient to reject casual
//      probes. Real attackers targeting a write endpoint would need to
//      break the sync logic itself, which runs with service-role only
//      after successful validation of GHL payloads.

export const Route = createFileRoute("/api/public/hooks/sync-ghl")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        const given = request.headers.get("apikey") ?? "";
        if (!expected || given !== expected) {
          return new Response("forbidden", { status: 403 });
        }
        try {
          const { syncGhlAppointments } = await import("@/lib/sync.server");
          const result = await syncGhlAppointments();
          return Response.json(result);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[sync-ghl] failed:", msg);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});