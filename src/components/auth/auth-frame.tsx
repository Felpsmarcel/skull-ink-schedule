import type { ReactNode } from "react";
import gfLockup from "@/assets/gf-lockup.png";

export function AuthFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="relative grid min-h-dvh place-items-start bg-background px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))] sm:place-items-center sm:px-6 sm:py-10">
      <section className="relative w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-[0_16px_40px_-20px_color-mix(in_oklab,var(--foreground)_25%,transparent)] sm:max-w-md">
        <div aria-hidden className="h-1 w-full bg-primary" />
        <div className="px-6 pb-2 pt-6 text-center sm:px-8 sm:pt-8">
          <img
            src={gfLockup}
            alt="GF Tattoo Studio"
            className="gf-logo-ink mx-auto h-14 w-auto object-contain sm:h-16"
          />
          <div
            aria-hidden
            className="mx-auto mt-4 h-px w-10 bg-[var(--brand-gold,var(--primary))]"
          />
          <h1 className="mt-4 font-editorial text-[1.75rem] font-semibold leading-tight text-foreground">
            {title}
          </h1>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="px-6 pb-6 pt-4 sm:px-8 sm:pb-8">{children}</div>
      </section>
    </main>
  );
}
