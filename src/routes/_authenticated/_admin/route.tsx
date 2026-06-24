import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: async () => {
    try {
      await requireAdmin();
    } catch (err) {
      throw redirect({ to: "/agenda" });
    }
  },
  component: () => <Outlet />,
});