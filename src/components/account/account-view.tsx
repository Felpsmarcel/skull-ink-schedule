import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  Banknote,
  Bot,
  CalendarClock,
  ChevronRight,
  FileText,
  Globe2,
  Layers3,
  Link2,
  LogOut,
  QrCode,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  UserSquare2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getAccountMenu, accountRoleLabel, type AccountIcon } from "@/lib/account-menu";
import type { MyProfile } from "@/lib/auth.functions";

const icons = {
  queue: Users,
  checkin: QrCode,
  report: FileText,
  wallet: Wallet,
  receipt: Banknote,
  links: Link2,
  artists: Users,
  sellers: UserSquare2,
  settings: Settings,
  reconcile: RefreshCw,
  health: Activity,
  assistant: Bot,
  projects: Layers3,
} satisfies Record<AccountIcon, typeof Users>;

export interface AccountViewProps {
  profile: MyProfile | null;
  isLoading?: boolean;
  error?: boolean;
  onRetry: () => void;
  onSignOut: () => void;
  isSigningOut?: boolean;
  signOutError?: string | null;
  receiptLink?: ReactNode;
}

/** Presentation shared by the authenticated route and the isolated review harness. */
export function AccountView({
  profile,
  isLoading,
  error,
  onRetry,
  onSignOut,
  isSigningOut,
  signOutError,
  receiptLink,
}: AccountViewProps) {
  const verifiedProfile = !isLoading && !error ? profile : null;
  const sections = getAccountMenu(verifiedProfile);
  const isAdmin = verifiedProfile?.role === "admin";
  const hasAccess = sections.length > 0;

  return (
    <div className="min-h-dvh bg-background pb-[calc(env(safe-area-inset-bottom)+7rem)] sm:pb-16">
      <PageHeader
        eyebrow="GF Tattoo Studio"
        title="Conta e gestão"
        description="Sua conta e as ferramentas do estúdio, em um só lugar."
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <section
          aria-label="Minha conta"
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
            <div
              className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"
              aria-hidden="true"
            >
              <UserRound className="size-6" />
            </div>
            <div className="min-w-0 flex-1 basis-44">
              <h2 className="font-editorial text-2xl text-foreground">
                {isAdmin ? "Administração do estúdio" : "Minha conta"}
              </h2>
              {isLoading ? (
                <p role="status" className="mt-1 text-sm text-muted-foreground">
                  Verificando seu acesso…
                </p>
              ) : error ? (
                <p role="alert" className="mt-1 text-sm text-destructive">
                  Não foi possível verificar sua conta.
                </p>
              ) : (
                <p className="mt-1 break-all text-sm text-muted-foreground">
                  {verifiedProfile?.email || "E-mail não disponível"}
                </p>
              )}
            </div>
            {verifiedProfile ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                {accountRoleLabel(verifiedProfile)}
              </span>
            ) : null}
            {error ? (
              <Button variant="outline" onClick={onRetry} className="min-h-11 rounded-xl">
                Tentar novamente
              </Button>
            ) : null}
            <Button
              variant="ghost"
              onClick={onSignOut}
              disabled={isSigningOut}
              className="min-h-11 rounded-xl text-muted-foreground"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {isSigningOut ? "Saindo…" : "Sair da conta"}
            </Button>
          </div>
          {signOutError ? (
            <p role="alert" className="border-t border-border px-5 py-3 text-sm text-destructive">
              {signOutError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border bg-background/60 px-5 py-3 text-xs text-muted-foreground sm:px-6">
            <span className="inline-flex items-center gap-2">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              Horários do estúdio: Bruxelas
            </span>
            <span className="inline-flex items-center gap-2">
              <Globe2 className="size-3.5" aria-hidden="true" />
              Valores em euro (€)
            </span>
          </div>
        </section>
        {!isLoading && !error && !hasAccess ? (
          <section className="rounded-2xl border border-border bg-card p-6" role="status">
            <h2 className="font-editorial text-2xl">Seu acesso precisa de um vínculo</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Peça à administração para conferir o perfil e o vínculo da sua conta com a equipe. Os
              atalhos ficam disponíveis depois dessa identificação.
            </p>
          </section>
        ) : null}
        {hasAccess ? (
          <>
            {isAdmin ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-accent/30 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold">Um recebimento para registrar?</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Identifique o cliente, o valor e quem recebeu.
                  </p>
                </div>
                <Link
                  to="/admin/movimentacao/novo"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                >
                  Registrar recebimento
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            ) : (
              receiptLink
            )}
            <div className="grid items-start gap-5 md:grid-cols-2">
              {sections.map((section) => (
                <section
                  key={section.id}
                  aria-labelledby={`account-${section.id}`}
                  className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                >
                  <div className="px-5 pb-4 pt-5 sm:px-6">
                    <h2 id={`account-${section.id}`} className="font-editorial text-2xl">
                      {section.title}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  <ul className="divide-y divide-border/70 border-t border-border/70">
                    {section.items.map((item) => {
                      const Icon = icons[item.icon];
                      return (
                        <li key={item.to}>
                          <Link
                            to={item.to}
                            className="group flex min-h-20 items-center gap-3 px-5 py-4 transition-colors duration-150 hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none sm:px-6"
                          >
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-background text-primary">
                              <Icon className="size-4" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">{item.label}</span>
                              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                {item.description}
                              </span>
                            </span>
                            <ChevronRight
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
