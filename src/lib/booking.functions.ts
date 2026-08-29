import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GF_LOCATION_ID, GF_PIPELINE_ID } from "@/lib/linking";
import {
  bookingErrorMessage,
  bookingOutcome,
  contactUpdatePatch,
  intervalErrorMessage,
  overlaps,
  priceServiceLines,
  resolveContactMatch,
  round2,
  slotIsFree,
  type CatalogService,
  type ContactCandidate,
  type BookingStep,
} from "@/lib/booking-core";

/* ------------------------------- Schema ------------------------------- */

const ServiceLineSchema = z.object({
  id: z.string().uuid(),
  discountPct: z.number().min(0).max(100).default(0),
  overridePriceEur: z.number().min(0).max(1_000_000).nullable().optional(),
});

const BookingSchema = z.object({
  artistId: z.string().uuid(),
  calendarId: z.string().min(5),
  locationId: z.string().min(5).default(GF_LOCATION_ID),
  startISO: z.string().min(10),
  endISO: z.string().min(10),
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).nullish(),
  status: z
    .enum(["pending", "confirmed", "cancelled", "completed", "no_show"])
    .default("confirmed"),
  services: z.array(ServiceLineSchema).min(1),
  sellerId: z.string().uuid().nullish(),
  depositEur: z.number().min(0).max(1_000_000).default(0),
  contact: z.object({
    ghlContactId: z.string().min(3).nullish(),
    name: z.string().max(200).nullish(),
    phone: z.string().max(40).nullish(),
    email: z.string().max(200).nullish(),
  }),
  project: z.object({
    decision: z.enum(["reuse", "new"]),
    reuseProjectId: z.string().uuid().nullish(),
    reuseOpportunityId: z.string().min(3).nullish(),
    projectType: z.enum(["new_tattoo", "cover_up", "retouch"]).default("new_tattoo"),
    description: z.string().max(2000).nullish(),
    bodyPart: z.string().max(120).nullish(),
    confirmNew: z.boolean().default(false),
  }),
  idempotencyKey: z.string().min(8).max(80),
});

export type FinalizeBookingInput = z.infer<typeof BookingSchema>;

export interface FinalizeBookingSuccess {
  kind: "created" | "reused";
  appointmentId: string;
  ghlEventId: string | null;
  projectId: string | null;
  ghlOpportunityId: string | null;
  ghlContactId: string | null;
  totalEur: number;
  commissionPct: number;
  warnings: string[];
}

export interface FinalizeBookingConflict {
  kind: "contact_conflict";
  reason: string;
  candidates: ContactCandidate[];
}

export type FinalizeBookingResult = FinalizeBookingSuccess | FinalizeBookingConflict;

/* ------------------------------ Orquestração ------------------------------ */

export const finalizeBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BookingSchema.parse(data))
  .handler(async ({ data, context }): Promise<FinalizeBookingResult> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const warnings: string[] = [];

    let step: BookingStep = "validated";
    let ghlContactId: string | null = data.contact.ghlContactId ?? null;
    let ghlOpportunityId: string | null = null;
    let ghlAppointmentId: string | null = null;
    let projectId: string | null = null;

    const opSelect =
      "id, status, step, ghl_contact_id, ghl_opportunity_id, ghl_appointment_id, project_id, appointment_id, attempts";

    async function saveOp(patch: Record<string, unknown>) {
      await supabaseAdmin
        .from("booking_operations")
        .upsert(
          { idempotency_key: data.idempotencyKey, ...patch },
          { onConflict: "idempotency_key" },
        );
    }

    function fail(detail: string): never {
      throw new Error(
        bookingErrorMessage({ step, detail, ghlContactId, ghlOpportunityId, ghlAppointmentId }),
      );
    }

    /* 0. Idempotência ------------------------------------------------- */
    const { data: existingAppt } = await supabase
      .from("appointments")
      .select("id, ghl_appointment_id, project_id, ghl_opportunity_id, ghl_contact_id, total_eur, commission_pct")
      .eq("chave_idempotencia", data.idempotencyKey)
      .maybeSingle();
    if (existingAppt) {
      return {
        kind: "reused",
        appointmentId: existingAppt.id,
        ghlEventId: existingAppt.ghl_appointment_id,
        projectId: existingAppt.project_id,
        ghlOpportunityId: existingAppt.ghl_opportunity_id,
        ghlContactId: existingAppt.ghl_contact_id,
        totalEur: Number(existingAppt.total_eur ?? 0),
        commissionPct: Number(existingAppt.commission_pct ?? 40),
        warnings,
      };
    }

    const { data: opRow } = await supabaseAdmin
      .from("booking_operations")
      .select(opSelect)
      .eq("idempotency_key", data.idempotencyKey)
      .maybeSingle();
    const prev = opRow as {
      ghl_contact_id: string | null;
      ghl_opportunity_id: string | null;
      ghl_appointment_id: string | null;
      project_id: string | null;
      attempts: number | null;
    } | null;
    if (prev) {
      ghlContactId = prev.ghl_contact_id ?? ghlContactId;
      ghlOpportunityId = prev.ghl_opportunity_id ?? null;
      ghlAppointmentId = prev.ghl_appointment_id ?? null;
      projectId = prev.project_id ?? null;
    }
    await saveOp({
      step: "validated",
      status: "in_progress",
      artist_id: data.artistId,
      start_at: data.startISO,
      attempts: (prev?.attempts ?? 0) + 1,
      error: null,
    });

    /* 1. Autorização e validações ------------------------------------- */
    if (data.locationId !== GF_LOCATION_ID) fail("locationId não autorizado");

    const { data: meRow, error: meErr } = await supabase
      .from("app_users")
      .select("role, artist_id, seller_id")
      .eq("id", userId)
      .maybeSingle();
    if (meErr) fail(meErr.message);
    const me = meRow as {
      role: "admin" | "artist" | "seller";
      artist_id: string | null;
      seller_id: string | null;
    } | null;
    if (!me) fail("usuário sem perfil");
    let sellerId = data.sellerId ?? null;
    if (me.role === "artist" && me.artist_id !== data.artistId) {
      fail("artistId não pertence ao usuário");
    }
    if (me.role === "seller") {
      if (!me.seller_id) fail("vendedor sem vínculo");
      sellerId = me.seller_id;
    }
    if (!["admin", "artist", "seller"].includes(me.role)) fail("papel sem permissão");

    const { validateBookingInterval } = await import("@/lib/booking-core");
    const interval = validateBookingInterval(data.startISO, data.endISO);
    if (!interval.ok) fail(intervalErrorMessage(interval.reason));

    const { data: artistRow, error: artistErr } = await supabase
      .from("artists")
      .select("id, name, ghl_calendar_id, ghl_user_id, commission_pct, active")
      .eq("id", data.artistId)
      .maybeSingle();
    if (artistErr) fail(artistErr.message);
    if (!artistRow) fail("artista não encontrado");
    const artist = artistRow;
    if (!artist.active) fail("artista inativo");
    if (!artist.ghl_calendar_id) fail("artista sem calendário do CRM configurado");
    if (artist.ghl_calendar_id !== data.calendarId) fail("calendarId não confere com o artista");
    const commissionPct = Number(artist.commission_pct ?? 40);

    // Preços — autoridade do servidor.
    const { data: svcRows, error: svcErr } = await supabase
      .from("services")
      .select("id, name, duration_min, modality, price_eur, price_on_request")
      .in(
        "id",
        data.services.map((s) => s.id),
      );
    if (svcErr) fail(svcErr.message);
    const catalog = new Map<string, CatalogService>();
    for (const r of svcRows ?? []) {
      catalog.set(r.id, {
        id: r.id,
        name: r.name,
        duration_min: r.duration_min,
        modality: String(r.modality),
        price_eur: Number(r.price_eur),
        price_on_request: Boolean(r.price_on_request),
      });
    }
    const priced = priceServiceLines(data.services, catalog);
    const depositEur = round2(Math.max(0, Math.min(data.depositEur ?? 0, priced.totalEur)));

    /* 2. Contato ------------------------------------------------------- */
    step = "contact";
    const {
      searchContactCandidates,
      createGhlContact,
      updateGhlContact,
      fetchFreeSlots,
      createGhlAppointment,
    } = await import("@/lib/booking.server");

    if (!ghlContactId) {
      const candidates = await searchContactCandidates({
        phone: data.contact.phone,
        email: data.contact.email,
        name: data.contact.name,
      });
      const resolution = resolveContactMatch({
        phone: data.contact.phone,
        email: data.contact.email,
        candidates,
      });
      if (resolution.kind === "conflict") {
        await saveOp({ step: "contact", status: "needs_selection", error: resolution.reason });
        return {
          kind: "contact_conflict",
          reason: resolution.reason,
          candidates: resolution.candidates,
        };
      }
      if (resolution.kind === "reuse") {
        ghlContactId = resolution.contact.id;
        const patch = contactUpdatePatch(resolution.contact, data.contact);
        if (Object.keys(patch).length > 0) {
          const ok = await updateGhlContact(ghlContactId, patch);
          if (!ok) warnings.push("Contato reutilizado, mas a atualização no CRM falhou.");
        }
      } else {
        const created = await createGhlContact(data.contact);
        if (!created.id) fail(created.error ?? "não foi possível criar o contato no CRM");
        ghlContactId = created.id;
      }
    }
    await saveOp({ step: "contact", status: "in_progress", ghl_contact_id: ghlContactId });

    // Espelha o contato localmente (usado por pagamentos/relatórios).
    let localContactId: string | null = null;
    {
      const { data: up } = await supabaseAdmin
        .from("contacts")
        .upsert(
          {
            ghl_contact_id: ghlContactId!,
            name: data.contact.name?.trim() || "Sem nome",
            email: data.contact.email ?? null,
            phone: data.contact.phone ?? null,
          },
          { onConflict: "ghl_contact_id" },
        )
        .select("id")
        .maybeSingle();
      localContactId = up?.id ?? null;
    }

    /* 3. Projeto / oportunidade --------------------------------------- */
    step = "project";
    if (!projectId) {
      const { findOpenOpportunities, createOpportunity, firstPipelineStageId } = await import(
        "@/lib/projects.server"
      );

      if (data.project.decision === "reuse") {
        let oppId = data.project.reuseOpportunityId ?? null;
        if (data.project.reuseProjectId) {
          const { data: proj } = await supabase
            .from("tattoo_projects")
            .select("id, ghl_opportunity_id")
            .eq("id", data.project.reuseProjectId)
            .maybeSingle();
          if (!proj) fail("projeto escolhido não existe");
          projectId = proj!.id;
          ghlOpportunityId = proj!.ghl_opportunity_id ?? oppId;
        } else {
          if (!oppId) fail("escolha a oportunidade existente ou confirme um novo projeto");
          // Revalida no servidor que a oportunidade continua aberta no pipeline oficial.
          const open = await findOpenOpportunities(ghlContactId!);
          const hit = open.find((o) => o.id === oppId && o.pipelineId === GF_PIPELINE_ID);
          if (!hit) fail("a oportunidade escolhida não está mais aberta no pipeline oficial");
          ghlOpportunityId = oppId;
          const { data: byOpp } = await supabase
            .from("tattoo_projects")
            .select("id")
            .eq("ghl_opportunity_id", oppId)
            .maybeSingle();
          projectId = byOpp?.id ?? null;
        }
      } else {
        if (!data.project.confirmNew) fail("criação de novo projeto exige confirmação explícita");
        const reason = (data.project.description ?? "").trim();
        if (reason.length < 5) fail("descreva o novo projeto para justificar outra oportunidade");
        // Repete a busca imediatamente antes de criar, para evitar corrida.
        const open = await findOpenOpportunities(ghlContactId!);
        const dup = open.find(
          (o) => o.pipelineId === GF_PIPELINE_ID && (o.name ?? "").trim() === data.title.trim(),
        );
        if (dup) {
          ghlOpportunityId = dup.id;
          warnings.push("Oportunidade equivalente já existia no CRM e foi reutilizada.");
        } else {
          const stageId = await firstPipelineStageId();
          if (!stageId) {
            fail(
              "etapa do pipeline não configurada com segurança — configure o estágio no CRM antes de criar novas oportunidades",
            );
          }
          const created = await createOpportunity({
            contactId: ghlContactId!,
            name: data.title,
            monetaryValue: priced.totalEur,
          });
          if (!created.id) fail(created.error ?? "falha ao criar a oportunidade no CRM");
          ghlOpportunityId = created.id;
        }
      }

      if (!projectId) {
        const { data: ins, error: insErr } = await supabaseAdmin
          .from("tattoo_projects")
          .insert({
            ghl_contact_id: ghlContactId,
            ghl_opportunity_id: ghlOpportunityId,
            ghl_pipeline_id: ghlOpportunityId ? GF_PIPELINE_ID : null,
            contact_id: localContactId,
            title: data.project.description?.trim() || data.title,
            description: data.project.description ?? null,
            project_type: data.project.projectType,
            body_part: data.project.bodyPart ?? null,
            artist_id: data.artistId,
            quoted_total_eur: priced.totalEur,
            deposit_eur: depositEur,
            status: "scheduled",
            created_by: userId,
            chave_idempotencia: `proj-${data.idempotencyKey}`,
          })
          .select("id")
          .maybeSingle();
        if (insErr || !ins) fail(insErr?.message ?? "falha ao gravar o projeto");
        projectId = ins!.id;
      }
    }
    await saveOp({
      step: "project",
      status: "in_progress",
      project_id: projectId,
      ghl_opportunity_id: ghlOpportunityId,
      payload: {
        row: {
          artist_id: data.artistId,
          calendar_id: data.calendarId,
          start_at: data.startISO,
          end_at: data.endISO,
          title: data.title,
        },
      },
    });

    /* 4. Calendário ---------------------------------------------------- */
    step = "calendar";
    if (!ghlAppointmentId) {
      // Sobreposição local.
      const dayStart = new Date(interval.startMs - 12 * 3600_000).toISOString();
      const dayEnd = new Date(interval.endMs + 12 * 3600_000).toISOString();
      const { data: near } = await supabase
        .from("appointments")
        .select("id, start_at, end_at, status")
        .eq("artist_id", data.artistId)
        .neq("status", "cancelled")
        .gte("start_at", dayStart)
        .lte("start_at", dayEnd);
      const clash = (near ?? []).find((a) =>
        overlaps(a.start_at, a.end_at, interval.startMs, interval.endMs),
      );
      if (clash) fail("já existe um agendamento deste artista neste horário");

      // Free-slot imediatamente antes de criar.
      const slots = await fetchFreeSlots(
        data.calendarId,
        interval.startMs - 3600_000,
        interval.endMs + 3600_000,
      );
      if (slots.ok && slots.slots.length > 0 && !slotIsFree(data.startISO, slots.slots)) {
        fail("o horário deixou de estar disponível no calendário");
      }
      if (!slots.ok) warnings.push("Não foi possível reconfirmar os horários livres no CRM.");

      /* 5. Evento ------------------------------------------------------ */
      step = "event";
      const ghlStatus =
        data.status === "pending" || data.status === "cancelled" ? "new" : "confirmed";
      const ev = await createGhlAppointment({
        calendarId: data.calendarId,
        contactId: ghlContactId!,
        startISO: data.startISO,
        endISO: data.endISO,
        title: data.title,
        notes: data.notes ?? null,
        status: ghlStatus,
      });
      if (!ev.id) {
        await saveOp({ step: "event", status: "failed", error: ev.error ?? "erro" });
        fail(ev.error ?? "falha ao criar o evento no calendário");
      }
      ghlAppointmentId = ev.id;
      await saveOp({
        step: "event",
        status: "in_progress",
        ghl_appointment_id: ghlAppointmentId,
      });
    }

    /* 6. Persistência local -------------------------------------------- */
    step = "persisted";
    const { data: ins, error: insErr } = await supabaseAdmin
      .from("appointments")
      .insert({
        ghl_appointment_id: ghlAppointmentId,
        ghl_contact_id: ghlContactId,
        contact_id: localContactId,
        project_id: projectId,
        ghl_opportunity_id: ghlOpportunityId,
        chave_idempotencia: data.idempotencyKey,
        artist_id: data.artistId,
        calendar_id: data.calendarId,
        contact_name: data.contact.name ?? null,
        contact_phone: data.contact.phone ?? null,
        contact_email: data.contact.email ?? null,
        start_at: data.startISO,
        end_at: data.endISO,
        status: data.status,
        total_eur: priced.totalEur,
        original_eur: priced.originalEur,
        commission_pct: commissionPct,
        services: priced.lines,
        notes: data.notes ?? null,
        seller_id: sellerId,
        deposit_eur: depositEur,
      })
      .select("id")
      .maybeSingle();

    const outcome = bookingOutcome({
      ghlAppointmentId,
      persisted: Boolean(ins && !insErr),
      failed: Boolean(insErr),
    });

    if (insErr || !ins) {
      await saveOp({
        step: outcome.step,
        status: outcome.status,
        error: insErr?.message ?? "insert sem retorno",
      });
      fail(
        `${insErr?.message ?? "gravação local falhou"} — operação marcada para reconciliação (nenhum evento será recriado)`,
      );
    }

    await saveOp({
      step: "persisted",
      status: "done",
      appointment_id: ins!.id,
      error: null,
    });

    // Sinal pago no ato → registra pagamento parcial.
    if (depositEur > 0 && localContactId) {
      try {
        await supabaseAdmin.from("payments").insert({
          appointment_id: ins!.id,
          contact_id: localContactId,
          amount_eur: depositEur,
          type: "deposit",
          method: "other",
          status: "paid",
          paid_at: new Date().toISOString(),
          notes: "Sinal registrado no agendamento",
          created_by: userId,
        });
      } catch (e) {
        console.error("[finalizeBooking] deposit registration failed", e);
        warnings.push("Sinal não foi registrado automaticamente.");
      }
    }

    return {
      kind: "created",
      appointmentId: ins!.id,
      ghlEventId: ghlAppointmentId,
      projectId,
      ghlOpportunityId,
      ghlContactId,
      totalEur: priced.totalEur,
      commissionPct,
      warnings,
    };
  });

/* ------------------------ Observabilidade / admin ------------------------ */

export interface BookingOperationRow {
  id: string;
  idempotencyKey: string;
  step: string;
  status: string;
  ghlContactId: string | null;
  ghlOpportunityId: string | null;
  ghlAppointmentId: string | null;
  projectId: string | null;
  appointmentId: string | null;
  attempts: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export const listBookingOperations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ onlyPending: z.boolean().default(false) })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<BookingOperationRow[]> => {
    const { supabase } = context;
    let q = supabase
      .from("booking_operations")
      .select(
        "id, idempotency_key, step, status, ghl_contact_id, ghl_opportunity_id, ghl_appointment_id, project_id, appointment_id, attempts, error, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.onlyPending) q = q.neq("status", "done");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      idempotencyKey: r.idempotency_key,
      step: r.step,
      status: r.status,
      ghlContactId: r.ghl_contact_id,
      ghlOpportunityId: r.ghl_opportunity_id,
      ghlAppointmentId: r.ghl_appointment_id,
      projectId: r.project_id,
      appointmentId: r.appointment_id,
      attempts: Number(r.attempts ?? 0),
      error: r.error,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  });

/**
 * Reprocessa apenas a persistência local de uma operação que já criou o
 * evento no CRM. Nunca cria contato, oportunidade ou evento novos.
 */
export const reconcileBookingOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ operationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ appointmentId: string; reused: boolean }> => {
    const { supabase, userId } = context;
    const { data: role } = await supabase.rpc("current_user_role");
    if (role !== "admin") throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: op, error } = await supabaseAdmin
      .from("booking_operations")
      .select("*")
      .eq("id", data.operationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!op) throw new Error("Operação não encontrada");
    if (!op.ghl_appointment_id) throw new Error("Operação sem evento no CRM — nada a reconciliar");

    const { data: existing } = await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("ghl_appointment_id", op.ghl_appointment_id)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin
        .from("booking_operations")
        .update({ appointment_id: existing.id, status: "done", step: "persisted", error: null })
        .eq("id", op.id);
      return { appointmentId: existing.id, reused: true };
    }

    const payload = (op.payload ?? {}) as { row?: Record<string, unknown> };
    const base = payload.row ?? {};
    const { data: ins, error: insErr } = await supabaseAdmin
      .from("appointments")
      .insert({
        ...(base as Record<string, never>),
        ghl_appointment_id: op.ghl_appointment_id,
        ghl_contact_id: op.ghl_contact_id,
        project_id: op.project_id,
        ghl_opportunity_id: op.ghl_opportunity_id,
        chave_idempotencia: op.idempotency_key,
        created_by: userId,
      } as never)
      .select("id")
      .maybeSingle();
    if (insErr || !ins) throw new Error(insErr?.message ?? "Falha ao reconciliar");

    await supabaseAdmin
      .from("booking_operations")
      .update({ appointment_id: ins.id, status: "done", step: "persisted", error: null })
      .eq("id", op.id);
    return { appointmentId: ins.id, reused: false };
  });
