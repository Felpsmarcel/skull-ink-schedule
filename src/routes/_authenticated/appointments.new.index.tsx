import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/appointments/new/")({
  beforeLoad: () => {
    throw redirect({ to: "/appointments/new/cliente" });
  },
  component: () => null,
});