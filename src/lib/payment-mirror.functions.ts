import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isCalendarDate } from "./payment-mirror-core";

export interface PaymentMirrorStatus {
  state: "preparacao" | "ativo";
  gates: {
    flag: boolean;
    scopesVerified: boolean;
    contractVerified: boolean;
    workflowsReviewed: boolean;
    draftHomologated: boolean;
  };
  pendingReasons: Array<{ state: string; reason: string; count: number }>;
}

async function assertAdmin(supabase: { from: (t: string) => unknown }, userId: string) {
  const q = supabase.from("app_users") as {
    select: (c: string) => {
      eq: (
        k: string,
        v: string,
      ) => { maybeSingle: () => Promise<{ data: { role?: string } | null; error: unknown }> };
    };
  };
  const { data, error } = await q.select("role").eq("id", userId).maybeSingle();
  if (error || data?.role !== "admin") throw new Error("Forbidden");
}

/** Admin-only. While disabled, returns "preparacao" without touching new tables or GHL. */
export const getPaymentMirrorStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentMirrorStatus> => {
    await assertAdmin(context.supabase as never, context.userId);
    const { readActivationGates } = await import("./payment-mirror.server");
    const { gatesOpen } = await import("./payment-mirror-core");
    const gates = readActivationGates();
    if (!gatesOpen(gates)) return { state: "preparacao", gates, pendingReasons: [] };
    const { data, error } = await context.supabase.rpc("mirror_pending_summary" as never);
    if (error) throw new Error("Falha ao ler pendências");
    const rows = (data ?? []) as Array<{ state: string; reason: string; total: number }>;
    return {
      state: "ativo",
      gates,
      pendingReasons: rows.map((r) => ({
        state: r.state,
        reason: r.reason,
        count: Number(r.total),
      })),
    };
  });

const ConfirmInput = z.object({
  source: z.enum(["payment", "booking_deposit", "movimentacao"]),
  sourceId: z.string().uuid(),
  expectedProjectId: z.string().uuid().optional(),
});

/** Admin confirmation of a real receipt. Disabled → returns without any RPC. Values are derived in SQL. */
export const confirmReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConfirmInput.parse(d))
  .handler(
    async ({ data, context }): Promise<{ ok: boolean; reason?: string; receiptId?: string }> => {
      await assertAdmin(context.supabase as never, context.userId);
      const { readActivationGates } = await import("./payment-mirror.server");
      const { gatesOpen } = await import("./payment-mirror-core");
      if (!gatesOpen(readActivationGates())) return { ok: false, reason: "desligado" };
      const { data: id, error } = await context.supabase.rpc(
        "confirm_receipt" as never,
        {
          p_source: data.source,
          p_source_id: data.sourceId,
          p_expected_project_id: data.expectedProjectId ?? null,
        } as never,
      );
      if (error) {
        const known = [
          "projeto_divergente",
          "contato_divergente",
          "fonte_invalida",
          "valor_invalido",
          "projeto_ausente",
          "contato_ausente",
          "data_ausente",
          "conflito_idempotencia",
          "conflito_mapeamento",
        ];
        return { ok: false, reason: known.find((k) => error.message.includes(k)) ?? "erro" };
      }
      return { ok: true, receiptId: id as unknown as string };
    },
  );

export interface ReceiptCandidate {
  source: "payment" | "movimentacao";
  sourceId: string; // Internal action key; never ask the operator to copy an ID.
  projectId: string | null;
  clientName: string;
  projectTitle: string;
  paidOn: string | null;
  amountCents: number | null; // Actual installment received, never the project's total or commission.
  method: string;
  confirmationStatus: "informado" | "confirmado" | "rejeitado";
  mirrorState:
    | "pending"
    | "fatura_a_conciliar"
    | "pagamento_a_conciliar"
    | "revisao"
    | "concluido"
    | null;
  blockReason: string | null;
  possibleDuplicate: boolean;
}
export interface ReceiptCandidatePage {
  state: "preparacao" | "ativo";
  from: string;
  to: string;
  rows: ReceiptCandidate[];
  limitReached: boolean;
}

function recentReceiptPeriod() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  return { from: start.toISOString().slice(0, 10), to: today };
}
const CalendarDate = z.string().refine(isCalendarDate, "Data inválida");
const CandidateInput = z
  .object({
    from: CalendarDate.optional(),
    to: CalendarDate.optional(),
    limit: z.number().int().min(1).max(100).default(100),
    includeHistorical: z.boolean().default(false),
  })
  .strict()
  .transform((input, ctx) => {
    const recent = recentReceiptPeriod();
    const from = input.from ?? recent.from;
    const to = input.to ?? recent.to;
    const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
    if (span < 0 || span > 365 || to > recent.to) {
      ctx.addIssue({
        code: "custom",
        message: "Use um período válido de até 366 dias, sem datas futuras.",
      });
    }
    if (from < recent.from && !input.includeHistorical) {
      ctx.addIssue({
        code: "custom",
        message: "Confirme a consulta de recebimentos anteriores aos últimos 30 dias.",
      });
    }
    return { ...input, from, to };
  });
const CandidateRow = z.object({
  source: z.enum(["payment", "movimentacao"]),
  source_id: z.string().uuid(),
  project_id: z.string().uuid().nullable(),
  client_name: z.string().max(500),
  project_title: z.string().max(500),
  paid_on: CalendarDate.nullable(),
  amount_cents: z.number().int().positive().max(2_147_483_647).nullable(),
  method: z.string().max(100),
  confirmation_status: z.enum(["informado", "confirmado", "rejeitado"]),
  mirror_state: z
    .enum(["pending", "fatura_a_conciliar", "pagamento_a_conciliar", "revisao", "concluido"])
    .nullable(),
  block_reason: z
    .enum([
      "projeto_ausente",
      "contato_ausente",
      "contato_divergente",
      "valor_invalido",
      "data_ausente",
      "confirmacao_inconsistente",
      "rejeitado",
    ])
    .nullable(),
  possible_duplicate: z.boolean(),
});

/** Read-only, signed-user admin scope. Closed gates never query the new RPC/tables. No backfill. */
export const getReceiptCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CandidateInput.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<ReceiptCandidatePage> => {
    await assertAdmin(context.supabase as never, context.userId);
    const { readActivationGates } = await import("./payment-mirror.server");
    const { gatesOpen } = await import("./payment-mirror-core");
    const page = {
      from: data.from,
      to: data.to,
      rows: [] as ReceiptCandidate[],
      limitReached: false,
    };
    if (!gatesOpen(readActivationGates())) return { ...page, state: "preparacao" };
    const { data: raw, error } = await context.supabase.rpc(
      "mirror_receipt_candidates" as never,
      {
        p_from: data.from,
        p_to: data.to,
        p_limit: data.limit,
        p_include_historical: data.includeHistorical,
      } as never,
    );
    if (error) throw new Error("Não foi possível carregar os recebimentos para conferência.");
    const rows = z
      .array(CandidateRow)
      .max(data.limit)
      .parse(raw ?? []);
    return {
      ...page,
      state: "ativo",
      limitReached: rows.length === data.limit,
      rows: rows.map((r) => ({
        source: r.source,
        sourceId: r.source_id,
        projectId: r.project_id,
        clientName: r.client_name,
        projectTitle: r.project_title,
        paidOn: r.paid_on,
        amountCents: r.amount_cents,
        method: r.method,
        confirmationStatus: r.confirmation_status,
        mirrorState: r.mirror_state,
        blockReason: r.block_reason,
        possibleDuplicate: r.possible_duplicate,
      })),
    };
  });
