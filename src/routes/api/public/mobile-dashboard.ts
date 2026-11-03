import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/mobile-dashboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { mobileDashboardResponse } = await import("@/lib/dashboard-api.server");
        return mobileDashboardResponse(request);
      },
    },
  },
});
