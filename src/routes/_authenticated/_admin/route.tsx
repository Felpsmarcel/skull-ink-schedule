import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";

export const Route = createFileRoute("/_authenticated/_admin")({
  pendingComponent: AdminPending,
  component: AdminGate,
});

function AdminPending() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm items-center justify-center px-4">
      <LoadingState label="Verificando acesso…" />
    </main>
  );
}

function AdminGate() {
  const { data, isLoading, isError, error, refetch } = useCurrentUser();
  const isAdmin = data?.role === "admin";

  if (isLoading) return <AdminPending />;

  if (isError) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-sm items-center justify-center px-4">
        <ErrorState
          title="Não foi possível verificar o acesso"
          description="Atualize a página ou entre novamente."
          details={error instanceof Error ? error.message : undefined}
          onRetry={() => { void refetch(); }}
        />
      </main>
    );
  }

  if (!isAdmin) {
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