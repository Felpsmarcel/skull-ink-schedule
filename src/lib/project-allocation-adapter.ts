/** Adaptadores do editor: produção (servidor, desativado por padrão) e fixture (memória, rotulada). */
import type { DraftLoad, SaveOutcome } from "@/lib/project-allocation-core";

export interface AllocationAdapter {
  environment: "production" | "fixture";
  load(): Promise<DraftLoad>;
  save(input: {
    expectedVersion: number;
    idempotencyKey: string;
    lines: { appointmentId: string; amountCents: number }[];
  }): Promise<SaveOutcome>;
}

/** Fixture: persiste só na memória desta aba; serve para ensaiar salvar→recarregar e conflito. */
const fixtureStore = new Map<
  string,
  { version: number; lines: Record<string, number>; keys: Map<string, number>; at: string }
>();

export function fixtureAdapter(
  projectId: string,
  contractCents: number | null,
  sessionIds: string[],
): AllocationAdapter {
  return {
    environment: "fixture",
    async load() {
      const s = fixtureStore.get(projectId);
      return {
        state: "ready",
        environment: "fixture",
        version: s?.version ?? 0,
        lines: { ...(s?.lines ?? {}) },
        frozen: [],
        updatedAt: s?.at ?? null,
        updatedByMe: s ? true : null,
      };
    },
    async save({ expectedVersion, idempotencyKey, lines }) {
      const s = fixtureStore.get(projectId) ?? { version: 0, lines: {}, keys: new Map(), at: "" };
      const replay = s.keys.get(idempotencyKey);
      if (replay !== undefined) return { state: "saved", version: replay, replayed: true };
      if (s.version !== expectedVersion) return { state: "conflict" };
      if (lines.some((l) => !sessionIds.includes(l.appointmentId)))
        return { state: "rejected", reason: "foreign_session" };
      const sum = lines.reduce((a, l) => a + l.amountCents, 0);
      if (!contractCents) return { state: "rejected", reason: "contract_unknown" };
      if (sum > contractCents) return { state: "rejected", reason: "exceeds_contract" };
      const version = s.version + 1;
      s.keys.set(idempotencyKey, version);
      fixtureStore.set(projectId, {
        version,
        lines: Object.fromEntries(lines.map((l) => [l.appointmentId, l.amountCents])),
        keys: s.keys,
        at: new Date().toISOString(),
      });
      return { state: "saved", version, replayed: false };
    },
  };
}

/** Só para a prévia: simula outra aba gravando antes, para demonstrar o estado de conflito. */
export function fixtureBumpVersion(projectId: string) {
  const s = fixtureStore.get(projectId) ?? { version: 0, lines: {}, keys: new Map(), at: "" };
  fixtureStore.set(projectId, { ...s, version: s.version + 1, at: new Date().toISOString() });
}
