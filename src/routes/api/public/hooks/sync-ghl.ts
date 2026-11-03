import { createFileRoute } from "@tanstack/react-router";
import { privateSyncAuthorized } from "@/lib/sync-auth.server";

export const Route = createFileRoute("/api/public/hooks/sync-ghl")({
  server: { handlers: {
    POST: async ({ request }) => {
      if (!privateSyncAuthorized(request, process.env.GHL_SYNC_SECRET)) return new Response("forbidden", { status: 403 });
      try {
        const { syncGhlAppointments } = await import("@/lib/sync.server");
        const result = await syncGhlAppointments({ source: "cron" });
        return Response.json(result, { status: result.ok ? 200 : 502 });
      } catch {
        return Response.json({ ok: false, error: "Sincronização não concluída." }, { status: 500 });
      }
    },
  } },
});
