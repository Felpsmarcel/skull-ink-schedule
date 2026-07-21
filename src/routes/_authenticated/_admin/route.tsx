import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";

export const Route = createFileRoute("/_authenticated/_admin")({
  component: AdminGate,
});

function AdminGate() {
  const { data, isLoading, isError } = useCurrentUser();
  const isAdmin = data?.role === "admin";

  if (isLoading) return <LoadingState label="Verificando acesso…" />;

  if (isError || !isAdmin) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center px-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Área administrativa
        </p>
        <h1 className="mt-2 text-xl font-bold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta página só abre em uma conta de administrador. A sessão atual está como{" "}
          <strong>{data?.role ?? "sem perfil"}</strong>.
        </p>
        <Button asChild className="mt-5 w-full">
          <Link to="/agenda">Voltar para agenda</Link>
        </Button>
      </main>
    );
  }

  return <Outlet />;
}