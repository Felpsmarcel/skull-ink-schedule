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
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-4 py-10 sm:px-6">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-primary/60" />
      <section className="relative w-full max-w-md overflow-hidden rounded-lg border border-border bg-card shadow-[0_24px_80px_color-mix(in_oklab,var(--background)_75%,transparent)]">
        <div className="border-b border-border bg-accent/40 px-6 py-7 text-center sm:px-8">
          <img src={gfLockup} alt="GF Tattoo Studio" className="mx-auto h-20 w-auto object-contain" />
          <div className="mx-auto mt-5 h-px w-12 bg-primary" />
          <h1 className="mt-5 font-display text-xl font-bold text-foreground">{title}</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <div className="px-6 py-6 sm:px-8 sm:py-8">{children}</div>
      </section>
    </main>
  );
}