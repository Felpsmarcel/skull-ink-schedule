import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProjectFicha } from "@/components/project-ficha/project-ficha";
import { SYNTHETIC_PROJECT, SYNTHETIC_OPPS } from "@/lib/project-ficha-fixture";

export const Route = createFileRoute("/_authenticated/_admin/preview/ficha-projeto")({
  head: () => ({
    meta: [
      { title: "Prévia da ficha de projeto (dados fictícios) · GF Tattoo" },
      { name: "description", content: "Demonstração com dados fictícios da ficha de projeto." },
      { property: "og:title", content: "Prévia da ficha de projeto · GF Tattoo" },
      { property: "og:description", content: "Demonstração com dados fictícios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PreviewPage,
});

function PreviewPage() {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pb-16 pt-4">
      <p
        role="note"
        className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
      >
        Dados fictícios de demonstração. Nada aqui lê ou grava dados reais.
      </p>
      <ProjectFicha
        p={SYNTHETIC_PROJECT}
        opps={{ kind: "ready", data: SYNTHETIC_OPPS }}
        selectedOpp={sel}
        onSelectOpp={setSel}
        persistDraft={false}
      />
    </main>
  );
}
