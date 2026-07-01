import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import "@/i18n";

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
    <div className="min-h-svh bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <h1 className="text-base font-bold uppercase tracking-wider">Avaliações</h1>
      </header>
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-muted">
          <Star className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="mt-6 text-lg font-semibold">Em breve</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          A coleta de avaliações via GHL e Google ainda não está integrada. Em breve você vai
          acompanhar feedback e nota média dos clientes por aqui.
        </p>
      </div>
    </div>
  );
}