/**
 * Contrato puro da persistência do rascunho de distribuição e do vínculo de oportunidade.
 * O servidor nunca confia em valores/IDs do navegador além de projectId, sessão e centavos,
 * que a RPC revalida contra o banco. Rascunho salvo não é recebimento nem comissão apurada.
 */
import { z } from "zod";

export const ALLOCATION_PERSISTENCE_FLAG = "PROJECT_ALLOCATION_PERSISTENCE";

export function persistenceEnabled(flag: string | undefined): boolean {
  return flag === "enabled";
}

export const SaveDraftSchema = z.object({
  projectId: z.string().uuid(),
  expectedVersion: z.number().int().min(0),
  idempotencyKey: z.string().min(16).max(100),
  lines: z
    .array(
      z.object({
        appointmentId: z.string().uuid(),
        amountCents: z.number().int().min(0).max(100_000_000),
      }),
    )
    .max(50)
    .refine((ls) => new Set(ls.map((l) => l.appointmentId)).size === ls.length, "duplicada"),
});
export type SaveDraftInput = z.infer<typeof SaveDraftSchema>;

export const LinkOppSchema = z.object({
  projectId: z.string().uuid(),
  opportunityId: z.string().min(3).max(64),
  keepContract: z.boolean(),
  idempotencyKey: z.string().min(16).max(100),
});

export type DraftLoad =
  | { state: "disabled"; environment: "production" }
  | { state: "ready"; environment: "production" | "fixture"; version: number; lines: Record<string, number>; frozen: string[]; updatedAt: string | null; updatedByMe: boolean | null };

export type SaveOutcome =
  | { state: "disabled" }
  | { state: "saved"; version: number; replayed: boolean }
  | { state: "conflict" }
  | { state: "rejected"; reason: AllocationError };

export type AllocationError =
  | "forbidden"
  | "project_not_found"
  | "invalid_line"
  | "foreign_session"
  | "cancelled_session"
  | "frozen_line"
  | "exceeds_contract"
  | "contract_unknown"
  | "contact_mismatch"
  | "linked_elsewhere"
  | "decision_required"
  | "ghl_incomplete"
  | "opportunity_not_found"
  | "unknown";

const KNOWN: AllocationError[] = [
  "forbidden", "project_not_found", "invalid_line", "foreign_session", "cancelled_session",
  "frozen_line", "exceeds_contract", "contract_unknown", "contact_mismatch", "linked_elsewhere",
  "decision_required",
];

/** Converte a mensagem da RPC em código; conflito de versão é tratado à parte. */
export function mapRpcError(message: string | null | undefined): AllocationError | "version_conflict" {
  const m = message ?? "";
  if (m.includes("version_conflict")) return "version_conflict";
  return KNOWN.find((k) => m.includes(k)) ?? "unknown";
}

export const ALLOCATION_ERROR_TEXT: Record<AllocationError, string> = {
  forbidden: "Somente o administrador pode salvar.",
  project_not_found: "Projeto não encontrado.",
  invalid_line: "Há um valor inválido.",
  foreign_session: "Uma sessão não pertence a este projeto.",
  cancelled_session: "Sessão cancelada não recebe valor.",
  frozen_line: "Uma sessão com repasse congelado não pode mudar.",
  exceeds_contract: "A distribuição excede o contrato.",
  contract_unknown: "Valor contratado a apurar.",
  contact_mismatch: "A oportunidade é de outro contato.",
  linked_elsewhere: "A oportunidade já pertence a outro projeto.",
  decision_required: "Valor da oportunidade difere do contrato: confirme manter o contrato.",
  ghl_incomplete: "Leitura completa do CRM indisponível; vínculo não confirmado.",
  opportunity_not_found: "Oportunidade não encontrada neste contato.",
  unknown: "Falha ao salvar. Nada foi alterado.",
};

/** Lost/Abandoned só como histórico; divergência de valor exige decisão explícita. */
export function evaluateOpportunityLink(input: {
  status: string | null;
  valueCents: number | null;
  contractCents: number | null;
  keepContract: boolean;
}): { kind: "active" | "historical"; needsDecision: boolean } {
  const s = (input.status ?? "").toLowerCase();
  const kind = s === "lost" || s === "abandoned" ? "historical" : "active";
  const equal =
    input.valueCents !== null && input.contractCents !== null && input.valueCents === input.contractCents;
  return { kind, needsDecision: kind === "active" && !equal && !input.keepContract };
}

export function newIdempotencyKey(): string {
  return `alloc-${crypto.randomUUID()}`;
}
