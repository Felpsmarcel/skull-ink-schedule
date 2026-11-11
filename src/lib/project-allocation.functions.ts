import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ALLOCATION_PERSISTENCE_FLAG,
  LinkOppSchema,
  SaveDraftSchema,
  evaluateOpportunityLink,
  mapRpcError,
  persistenceEnabled,
  type AllocationError,
  type DraftLoad,
  type SaveOutcome,
} from "@/lib/project-allocation-core";

/* Adaptador de produção DESATIVADO por padrão: só liga com a flag de servidor
   PROJECT_ALLOCATION_PERSISTENCE=enabled, após o SQL de revisão ser aplicado e validado. */

async function requireAdmin(supabase: unknown, userId: string) {
  const { data, error } = await (supabase as { from: (t: string) => any })
    .from("app_users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível verificar o acesso");
  if (data?.role !== "admin") throw new Error("Acesso negado");
}

const enabled = () => persistenceEnabled(process.env[ALLOCATION_PERSISTENCE_FLAG]);

export const getAllocationDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<DraftLoad> => {
    await requireAdmin(context.supabase, context.userId);
    if (!enabled()) return { state: "disabled", environment: "production" };
    const sb = context.supabase as unknown as { from: (t: string) => any };
    const [d, l] = await Promise.all([
      sb.from("project_allocation_drafts").select("version, updated_at, updated_by").eq("project_id", data.projectId).maybeSingle(),
      sb.from("project_allocation_lines").select("appointment_id, amount_cents, frozen_at").eq("project_id", data.projectId),
    ]);
    if (d.error || l.error) throw new Error("Não foi possível carregar o rascunho salvo");
    const rows = (l.data ?? []) as { appointment_id: string; amount_cents: number | string; frozen_at: string | null }[];
    return {
      state: "ready",
      environment: "production",
      version: d.data?.version ?? 0,
      lines: Object.fromEntries(rows.map((r) => [r.appointment_id, Number(r.amount_cents)])),
      frozen: rows.filter((r) => r.frozen_at).map((r) => r.appointment_id),
      updatedAt: d.data?.updated_at ?? null,
      updatedByMe: d.data ? d.data.updated_by === context.userId : null,
    };
  });

export const saveAllocationDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveDraftSchema.parse(d))
  .handler(async ({ data, context }): Promise<SaveOutcome> => {
    await requireAdmin(context.supabase, context.userId);
    if (!enabled()) return { state: "disabled" };
    const { data: r, error } = await (context.supabase as unknown as { rpc: (n: string, a: unknown) => any }).rpc(
      "save_project_allocation_draft",
      {
        p_project_id: data.projectId,
        p_expected_version: data.expectedVersion,
        p_idempotency_key: data.idempotencyKey,
        p_lines: data.lines.map((x) => ({ appointment_id: x.appointmentId, amount_cents: x.amountCents })),
      },
    );
    if (error) {
      const code = mapRpcError(error.message);
      if (code === "version_conflict") return { state: "conflict" };
      console.error("[allocation] save rejected", code);
      return { state: "rejected", reason: code };
    }
    return { state: "saved", version: Number(r.version), replayed: Boolean(r.replayed) };
  });

export type LinkOutcome =
  | { state: "disabled" }
  | { state: "linked"; kind: "active" | "historical"; replayed: boolean }
  | { state: "rejected"; reason: AllocationError };

/** Revalida a oportunidade em leitura GHL completa; status/valor vêm do CRM, não do navegador. */
export const linkProjectOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LinkOppSchema.parse(d))
  .handler(async ({ data, context }): Promise<LinkOutcome> => {
    await requireAdmin(context.supabase, context.userId);
    if (!enabled()) return { state: "disabled" };
    const { data: p, error } = await context.supabase
      .from("tattoo_projects")
      .select("id, ghl_contact_id, quoted_total_eur")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) return { state: "rejected", reason: "unknown" };
    if (!p) return { state: "rejected", reason: "project_not_found" };
    if (!p.ghl_contact_id) return { state: "rejected", reason: "contact_mismatch" };
    const { listContactOpportunities } = await import("@/lib/projects.server");
    const res = await listContactOpportunities(p.ghl_contact_id);
    if (!res.complete) return { state: "rejected", reason: "ghl_incomplete" };
    const opp = res.items.find((o) => o.id === data.opportunityId);
    if (!opp) return { state: "rejected", reason: "opportunity_not_found" };
    const contractCents = Math.round(Number(p.quoted_total_eur) * 100);
    const ev = evaluateOpportunityLink({
      status: opp.status,
      valueCents: opp.monetaryValueCents,
      contractCents,
      keepContract: data.keepContract,
    });
    if (ev.needsDecision) return { state: "rejected", reason: "decision_required" };
    const { data: r, error: e2 } = await (context.supabase as unknown as { rpc: (n: string, a: unknown) => any }).rpc(
      "link_project_opportunity",
      {
        p_project_id: p.id,
        p_opportunity_id: opp.id,
        p_contact_id: p.ghl_contact_id,
        p_status: opp.status ?? "unknown",
        p_value_cents: opp.monetaryValueCents,
        p_contract_decision: data.keepContract ? "keep_contract" : null,
        p_idempotency_key: data.idempotencyKey,
      },
    );
    if (e2) {
      const c = mapRpcError(e2.message);
      return { state: "rejected", reason: c === "version_conflict" ? "unknown" : c };
    }
    return { state: "linked", kind: r.kind, replayed: Boolean(r.replayed) };
  });
