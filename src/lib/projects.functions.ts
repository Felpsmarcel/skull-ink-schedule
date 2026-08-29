import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GF_PIPELINE_ID } from "@/lib/linking";

/* ------------------------------- Tipos ------------------------------- */

export interface ProjectContextContact {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

export interface ProjectContextOpportunity {
  id: string;
  name: string | null;
  status: string | null;
  monetaryValue: number | null;
  /** Projeto local já ligado a esta oportunidade, quando existir. */
  localProjectId: string | null;
}

export interface ProjectContextProject {
  id: string;
  title: string;
  status: string;
  projectType: string;
  ghlOpportunityId: string | null;
  quotedTotalEur: number;
  depositEur: number;
  artistId: string | null;
}

export interface ProjectContextResult {
  pipelineId: string;
  contact: ProjectContextContact | null;
  openOpportunities: ProjectContextOpportunity[];
  projects: ProjectContextProject[];
  warning?: string;
}

/* -------------------- 1. Lookup contato/oportunidade -------------------- */

const LookupSchema = z.object({
  ghlContactId: z.string().min(3).nullish(),
  phone: z.string().max(40).nullish(),
  email: z.string().max(200).nullish(),
  name: z.string().max(200).nullish(),
});

export const lookupProjectContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => LookupSchema.parse(data))
  .handler(async ({ data, context }): Promise<ProjectContextResult> => {
    const { supabase } = context;
    const { findGhlContact, findOpenOpportunities } = await import("@/lib/projects.server");

    let contact: ProjectContextContact | null = null;
    let warning: string | undefined;

    try {
      if (data.ghlContactId) {
        contact = { id: data.ghlContactId, name: data.name ?? null, phone: data.phone ?? null, email: data.email ?? null };
      } else {
        contact = await findGhlContact({ phone: data.phone, email: data.email, name: data.name });
      }
    } catch (e) {
      warning = e instanceof Error ? e.message : String(e);
    }

    let openOpportunities: ProjectContextOpportunity[] = [];
    let projects: ProjectContextProject[] = [];

    if (contact) {
      try {
        const opps = await findOpenOpportunities(contact.id);
        openOpportunities = opps.map((o) => ({
          id: o.id,
          name: o.name,
          status: o.status,
          monetaryValue: o.monetaryValue,
          localProjectId: null,
        }));
      } catch (e) {
        warning = e instanceof Error ? e.message : String(e);
      }

      const { data: rows, error } = await supabase
        .from("tattoo_projects")
        .select(
          "id, title, status, project_type, ghl_opportunity_id, quoted_total_eur, deposit_eur, artist_id",
        )
        .eq("ghl_contact_id", contact.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      projects = (rows ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        status: String(r.status),
        projectType: String(r.project_type),
        ghlOpportunityId: r.ghl_opportunity_id,
        quotedTotalEur: Number(r.quoted_total_eur ?? 0),
        depositEur: Number(r.deposit_eur ?? 0),
        artistId: r.artist_id,
      }));

      const byOpp = new Map(projects.filter((p) => p.ghlOpportunityId).map((p) => [p.ghlOpportunityId!, p.id]));
      openOpportunities = openOpportunities.map((o) => ({
        ...o,
        localProjectId: byOpp.get(o.id) ?? null,
      }));
    }

    return {
      pipelineId: GF_PIPELINE_ID,
      contact,
      openOpportunities,
      projects,
      ...(warning ? { warning } : {}),
    };
  });

/* ---------------------- 2. Criar / reutilizar projeto ---------------------- */

const EnsureSchema = z.object({
  ghlContactId: z.string().min(3),
  contactName: z.string().max(200).nullish(),
  artistId: z.string().uuid().nullish(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  projectType: z.enum(["new_tattoo", "cover_up", "retouch"]).default("new_tattoo"),
  bodyPart: z.string().max(120).nullish(),
  quotedTotalEur: z.number().min(0).max(1_000_000).default(0),
  depositEur: z.number().min(0).max(1_000_000).default(0),
  /** Projeto local já existente para reutilizar. */
  reuseProjectId: z.string().uuid().nullish(),
  /** Oportunidade aberta existente do mesmo projeto. */
  reuseOpportunityId: z.string().min(3).nullish(),
  /** Obrigatório para criar nova oportunidade no pipeline oficial. */
  confirmNewOpportunity: z.boolean().default(false),
  idempotencyKey: z.string().min(8).max(80),
});

export interface EnsureProjectResult {
  projectId: string;
  ghlOpportunityId: string | null;
  reused: boolean;
  createdOpportunity: boolean;
  warning?: string;
}

export const ensureTattooProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EnsureSchema.parse(data))
  .handler(async ({ data, context }): Promise<EnsureProjectResult> => {
    const { supabase, userId } = context;

    // Idempotência: reenvio devolve o mesmo projeto.
    const { data: existingKey } = await supabase
      .from("tattoo_projects")
      .select("id, ghl_opportunity_id")
      .eq("chave_idempotencia", data.idempotencyKey)
      .maybeSingle();
    if (existingKey) {
      return {
        projectId: existingKey.id,
        ghlOpportunityId: existingKey.ghl_opportunity_id,
        reused: true,
        createdOpportunity: false,
      };
    }

    // Reutilizar projeto local explicitamente escolhido.
    if (data.reuseProjectId) {
      const { data: proj, error } = await supabase
        .from("tattoo_projects")
        .select("id, ghl_opportunity_id")
        .eq("id", data.reuseProjectId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!proj) throw new Error("Projeto não encontrado");
      return {
        projectId: proj.id,
        ghlOpportunityId: proj.ghl_opportunity_id,
        reused: true,
        createdOpportunity: false,
      };
    }

    // Reutilizar oportunidade existente: se já houver projeto ligado, devolve.
    let opportunityId: string | null = data.reuseOpportunityId ?? null;
    let createdOpportunity = false;
    let warning: string | undefined;

    if (opportunityId) {
      const { data: byOpp } = await supabase
        .from("tattoo_projects")
        .select("id, ghl_opportunity_id")
        .eq("ghl_opportunity_id", opportunityId)
        .maybeSingle();
      if (byOpp) {
        return {
          projectId: byOpp.id,
          ghlOpportunityId: byOpp.ghl_opportunity_id,
          reused: true,
          createdOpportunity: false,
        };
      }
    } else {
      if (!data.confirmNewOpportunity) {
        throw new Error(
          "Confirmação necessária: escolha uma oportunidade existente ou confirme a criação de um novo projeto/oportunidade.",
        );
      }
      const { createOpportunity } = await import("@/lib/projects.server");
      const res = await createOpportunity({
        contactId: data.ghlContactId,
        name: data.title,
        monetaryValue: data.quotedTotalEur,
      });
      if (res.id) {
        opportunityId = res.id;
        createdOpportunity = true;
      } else {
        warning = `Projeto criado sem oportunidade no CRM: ${res.error ?? "erro desconhecido"}`;
        console.error("[ensureTattooProject] createOpportunity failed", res.error);
      }
    }

    const { data: contactRow } = await supabase
      .from("contacts")
      .select("id")
      .eq("ghl_contact_id", data.ghlContactId)
      .maybeSingle();

    const { data: ins, error: insErr } = await supabase
      .from("tattoo_projects")
      .insert({
        ghl_contact_id: data.ghlContactId,
        ghl_opportunity_id: opportunityId,
        ghl_pipeline_id: opportunityId ? GF_PIPELINE_ID : null,
        contact_id: contactRow?.id ?? null,
        title: data.title,
        description: data.description ?? null,
        project_type: data.projectType,
        body_part: data.bodyPart ?? null,
        artist_id: data.artistId ?? null,
        quoted_total_eur: data.quotedTotalEur,
        deposit_eur: data.depositEur,
        status: "scheduled",
        created_by: userId,
        chave_idempotencia: data.idempotencyKey,
      })
      .select("id, ghl_opportunity_id")
      .single();
    if (insErr || !ins) throw new Error(insErr?.message ?? "Falha ao criar projeto");

    return {
      projectId: ins.id,
      ghlOpportunityId: ins.ghl_opportunity_id,
      reused: false,
      createdOpportunity,
      ...(warning ? { warning } : {}),
    };
  });

/* ------------------------- 3. Finanças do projeto ------------------------- */

export interface ProjectFinance {
  projectId: string;
  title: string;
  quotedTotalEur: number;
  sinalEur: number;
  recebidoEur: number;
  saldoEur: number;
}

export const getProjectFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ projectId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<ProjectFinance> => {
    const { supabase } = context;
    const { data: proj, error } = await supabase
      .from("tattoo_projects")
      .select("id, title, quoted_total_eur, deposit_eur")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!proj) throw new Error("Projeto não encontrado");

    const { data: movs, error: mErr } = await supabase
      .from("movimentacoes")
      .select("total, tipo_movimento")
      .eq("project_id", data.projectId)
      .is("deleted_at", null);
    if (mErr) throw new Error(mErr.message);

    let sinal = Number(proj.deposit_eur ?? 0);
    let recebido = 0;
    for (const m of movs ?? []) {
      const v = Number(m.total ?? 0);
      const signed = m.tipo_movimento === "estorno" ? -v : v;
      recebido += signed;
      if (m.tipo_movimento === "sinal") sinal += signed;
    }
    const quoted = Number(proj.quoted_total_eur ?? 0);
    return {
      projectId: proj.id,
      title: proj.title,
      quotedTotalEur: quoted,
      sinalEur: round2(sinal),
      recebidoEur: round2(recebido),
      saldoEur: round2(Math.max(0, quoted - recebido)),
    };
  });

/* --------------------- 4. Alvos de pagamento (agenda) --------------------- */

export interface PaymentTarget {
  appointmentId: string;
  projectId: string | null;
  ghlContactId: string | null;
  ghlAppointmentId: string | null;
  ghlOpportunityId: string | null;
  contactName: string | null;
  artistId: string;
  startAt: string;
  totalEur: number;
  depositEur: number;
}

export const listPaymentTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ search: z.string().max(120).nullish() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<PaymentTarget[]> => {
    const { supabase } = context;
    const since = new Date(Date.now() - 180 * 24 * 3600_000).toISOString();
    let q = supabase
      .from("appointments")
      .select(
        "id, project_id, ghl_contact_id, ghl_appointment_id, ghl_opportunity_id, contact_name, artist_id, start_at, total_eur, deposit_eur",
      )
      .gte("start_at", since)
      .neq("status", "cancelled")
      .order("start_at", { ascending: false })
      .limit(30);
    const term = (data.search ?? "").trim();
    if (term.length >= 2) q = q.ilike("contact_name", `%${term}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      appointmentId: r.id,
      projectId: r.project_id,
      ghlContactId: r.ghl_contact_id,
      ghlAppointmentId: r.ghl_appointment_id,
      ghlOpportunityId: r.ghl_opportunity_id,
      contactName: r.contact_name,
      artistId: r.artist_id,
      startAt: r.start_at,
      totalEur: Number(r.total_eur ?? 0),
      depositEur: Number(r.deposit_eur ?? 0),
    }));
  });

/* ----------------------- 5. Vínculos incompletos ----------------------- */

export interface VinculosIncompletos {
  appointmentsSemProjeto: number;
  appointmentsSemOportunidade: number;
  movimentacoesSemVinculo: number;
  total: number;
}

export const getVinculosIncompletos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VinculosIncompletos> => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("count_vinculos_incompletos");
    if (error) throw new Error(error.message);
    const r = (data ?? {}) as Partial<VinculosIncompletos>;
    return {
      appointmentsSemProjeto: Number(r.appointmentsSemProjeto ?? 0),
      appointmentsSemOportunidade: Number(r.appointmentsSemOportunidade ?? 0),
      movimentacoesSemVinculo: Number(r.movimentacoesSemVinculo ?? 0),
      total: Number(r.total ?? 0),
    };
  });

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
