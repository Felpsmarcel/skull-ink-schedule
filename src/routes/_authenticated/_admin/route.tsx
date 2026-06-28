import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/_admin")({
  component: AdminGate,
});

function AdminGate() {
  const { data, isLoading, isError } = useCurrentUser();
  if (isLoading) return null;
  if (isError || data?.role !== "admin") {
    throw redirect({ to: "/agenda" });
  }
  return <Outlet />;
}