import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint. Lovable's edge bypasses auth on /api/public/*, so we
// verify the apikey header matches the project anon/publishable key.

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