import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ProjectFicha } from "../../src/components/project-ficha/project-ficha";
import { SYNTHETIC_PROJECT, SYNTHETIC_OPPS } from "../../src/lib/project-ficha-fixture";
import { fixtureAdapter } from "../../src/lib/project-allocation-adapter";
import "../../src/styles.css";
const p = SYNTHETIC_PROJECT;
const adapter = fixtureAdapter(
  p.id,
  p.finance.quotedCents,
  p.sessions.map((s) => s.id),
);
export function App() {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <main style={{ maxWidth: 768, margin: "auto", padding: 20 }}>
      <p role="note">
        TESTE LOCAL · Dados fictícios · Sem conexão com CRM · Vínculos descartados ao recarregar.
      </p>
      <ProjectFicha
        p={p}
        opps={{ kind: "ready", data: SYNTHETIC_OPPS }}
        selectedOpp={sel}
        onSelectOpp={setSel}
        allocationAdapter={adapter}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
