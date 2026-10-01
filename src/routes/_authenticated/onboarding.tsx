import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute, Link, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router";
import { getOnboardingStatus } from "@/lib/onboarding.functions";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";

const STEPS = [
  { path: "/onboarding/bem-vindo", label: "Bem-vindo" },
  { path: "/onboarding/perfil", label: "Perfil" },
  { path: "/onboarding/disponibilidade", label: "Horários" },
  { path: "/onboarding/servicos", label: "Serviços" },
  { path: "/onboarding/pronto", label: "Pronto" },
];

export const Route = createFileRoute("/_authenticated/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const status = await getOnboardingStatus();
    if (status.role !== "artist") {
      throw redirect({ to: "/agenda" });
    }
    return { onboarding: status };
  },
  pendingComponent: OnboardingPending,
  errorComponent: OnboardingError,
  component: OnboardingLayout,
});

function OnboardingPending() {
  return (
    <div className="mx-auto flex min-h-svh max-w-lg items-center justify-center px-5">
      <LoadingState label="Carregando configuração…" />
    </div>
  );
}

function OnboardingError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div className="mx-auto flex min-h-svh max-w-lg items-center justify-center px-5">
      <ErrorState
        title="Não foi possível abrir a configuração"
        description="Atualize a página ou tente voltar para a agenda."
        details={(error as Error).message}
        onRetry={() => {
          router.invalidate();
          reset();
        }}
      />
    </div>
  );
}

function OnboardingLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentIdx = Math.max(
    0,
    STEPS.findIndex((s) => pathname.startsWith(s.path)),
  );
  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col px-5 pb-16 pt-8">
      <header className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Configuração inicial · {currentIdx + 1} de {STEPS.length}
        </p>
        <div className="mt-3 flex gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s.path}
              className={`h-1 flex-1 rounded-full ${i <= currentIdx ? "bg-foreground" : "bg-muted"}`}
            />
          ))}
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-6 text-center">
        <Link to="/menu" className="text-[11px] uppercase tracking-wider text-muted-foreground underline">
          Sair
        </Link>
      </footer>
    </div>
  );
}