import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/_admin")({
  component: AdminGate,
});

function AdminGate() {
  const { data, isLoading, isError } = useCurrentUser();
  const navigate = useNavigate();
  const isAdmin = data?.role === "admin";

  useEffect(() => {
    if (!isLoading && (isError || !isAdmin)) {
      navigate({ to: "/agenda", replace: true });
    }
  }, [isLoading, isError, isAdmin, navigate]);

  if (isLoading || !isAdmin) return null;
  return <Outlet />;
}