import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import "@/i18n";
import { PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/_authenticated/reviews")({
  head: () => ({
    meta: [
      { title: "Avaliações — GF Tattoo Studio" },
      { name: "description", content: "Feedback dos clientes do GF Tattoo Studio." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ReviewsPage,
});

function ReviewsPage() {
  return (
    <div className="min-h-svh bg-background pb-[calc(env(safe-area-inset-bottom)+7rem)] text-foreground sm:pb-24">
      <PageHeader eyebrow="Relacionamento com clientes" title="Avaliações" />
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <section className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm sm:py-16">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-accent">
            <Star aria-hidden="true" className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mt-6 font-editorial text-2xl font-semibold">Em breve</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            A coleta de avaliações via GHL e Google ainda não está integrada. Em breve você vai
            acompanhar feedback e nota média dos clientes por aqui.
          </p>
        </section>
      </main>
    </div>
  );
}
