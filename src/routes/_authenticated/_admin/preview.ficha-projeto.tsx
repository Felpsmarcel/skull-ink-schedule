import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fixtureAdapter, fixtureBumpVersion } from "@/lib/project-allocation-adapter";
import { usePortugueseWhileMounted } from "@/hooks/use-portuguese-while-mounted";
import { ProjectFicha } from "@/components/project-ficha/project-ficha";
import { SYNTHETIC_PROJECT, SYNTHETIC_OPPS } from "@/lib/project-ficha-fixture";

/** Altere a cada revisão da prévia para confirmar que a aba mostra a versão mais recente. */
const FIXTURE_REVISION = "r4 local · 2026-11-11 · vínculo de oportunidade";

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
  usePortugueseWhileMounted();
  const [sel, setSel] = useState<string | null>(null);
  const [mount, setMount] = useState(0);
  const p = SYNTHETIC_PROJECT;
  const adapter = useMemo(
    () =>
      fixtureAdapter(
        p.id,
        p.finance.quotedCents,
        p.sessions.map((s) => s.id),
      ),
    [p],
  );
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pb-16 pt-4">
      <p
        role="note"
        className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
      >
        Ambiente: fixture com dados fictícios, só para administradores. “Salvar” grava apenas na
        memória desta aba — nada lê ou grava dados reais. Revisão {FIXTURE_REVISION}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="min-h-11" onClick={() => setMount((m) => m + 1)}>
          Simular recarregar ficha
        </Button>
        <Button variant="outline" className="min-h-11" onClick={() => fixtureBumpVersion(p.id)}>
          Simular outra aba salvando
        </Button>
      </div>
      <ProjectFicha
        key={mount}
        p={p}
        allocationAdapter={adapter}
        opps={{ kind: "ready", data: SYNTHETIC_OPPS }}
        selectedOpp={sel}
        onSelectOpp={setSel}
      />
    </main>
  );
}
