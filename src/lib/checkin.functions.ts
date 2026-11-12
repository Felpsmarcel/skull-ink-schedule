import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import {
  canonicalCheckinInput,
  checkinTransitionPatch,
  checkinDayBounds,
  requireReceptionRole,
} from "@/lib/checkin-policy";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PROD_ORIGIN = "https://www.gftattoocalendar.com";

export type CheckinStatus =
  | "aguardando"
  | "em_atendimento"
  | "concluido"
  | "nao_compareceu"
  | "cancelado";

export interface TotemCandidate {
  contactId: string;
  ghlContactId: string | null;
  /** Nome parcialmente mascarado (ex.: "Maria S.") */
  nomeMascarado: string;
  /** Telefone mascarado (ex.: "•••• 4321") */
  telefoneMascarado: string | null;
  temTelefone: boolean;
  agendamentoHoje: {
    appointmentId: string;
    scheduledAtISO: string;
    artistId: string | null;
    artistNome: string | null;
  } | null;
}

export interface TotemSession {
  contactId: string;
  nome: string;
  telefone: string | null;
  ghlContactId: string | null;
  agendamentoHoje: TotemCandidate["agendamentoHoje"];
  agendamentosHoje: NonNullable<TotemCandidate["agendamentoHoje"]>[];
}

export interface CheckinCreated {
  token: string;
  codigo: string;
  qrUrl: string;
  scheduledAtISO: string | null;
  artistNome: string | null;
  jaExistia: boolean;
}

export interface CheckinPublicView {
  codigo: string;
  status: CheckinStatus;
  scheduledAtISO: string | null;
  arrivedAtISO: string;
  tatuadorPrimeiroNome: string | null;
  expirado: boolean;
}

export interface FilaRow {
  id: string;
  clienteNome: string;
  codigo: string;
  status: CheckinStatus;
  arrivedAtISO: string;
  startedAtISO: string | null;
  scheduledAtISO: string | null;
  artistId: string | null;
  tatuador: string | null;
  appointmentId: string | null;
  syncStatus: "pending" | "synced" | "failed" | null;
}

// ------------------------- helpers ---------------------------------------

function onlyDigits(value: string) {
  return value.replace(/\D+/g, "");
}

function maskNome(nome: string) {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  const first = parts[0]!;
  if (parts.length === 1) return first;
  return `${first} ${parts[parts.length - 1]!.charAt(0).toUpperCase()}.`;
}

function maskTelefone(telefone: string | null) {
  return telefone ? "Telefone cadastrado" : null;
}

async function requireCheckinReception(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("app_users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  requireReceptionRole(error ? null : data);
}

function brusselsDayBoundsISO() {
  return checkinDayBounds();
}
function endOfBrusselsDayISO() {
  return checkinDayBounds().endISO;
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ------------------------- totem: busca ----------------------------------

export const searchTotemClientes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ query: z.string().trim().max(120) }).parse(input))
  .handler(async ({ data, context }): Promise<TotemCandidate[]> => {
    await requireCheckinReception(context.supabase, context.userId);
    const raw = (data.query ?? "").trim();
    if (raw.length < 3) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const digits = onlyDigits(raw);
    const isPhone = digits.length >= 6;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any)
      .from("contacts")
      .select("id, ghl_contact_id, name, phone")
      .limit(8);

    if (isPhone) {
      query = query.ilike("phone", `%${digits.slice(-8)}%`);
    } else {
      query = query.ilike("name", `%${raw}%`).neq("name", "Sem nome");
    }

    const { data: rows, error } = await query;
    if (error) {
      throw new Error("Não foi possível consultar os clientes.");
    }

    const contacts = (rows ?? []) as Array<{
      id: string;
      ghl_contact_id: string | null;
      name: string | null;
      phone: string | null;
    }>;
    if (contacts.length === 0) return [];

    const { startISO, endISO } = brusselsDayBoundsISO();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: appts, error: appointmentsError } = await (supabaseAdmin as any)
      .from("appointments")
      .select("id, contact_id, start_at, artist_id, artists(name)")
      .in(
        "contact_id",
        contacts.map((c) => c.id),
      )
      .gte("start_at", startISO)
      .lt("start_at", endISO)
      .in("status", ["pending", "confirmed"])
      .order("start_at", { ascending: true });

    if (appointmentsError) throw new Error("Não foi possível consultar os agendamentos.");
    const byContact = new Map<
      string,
      {
        appointmentId: string;
        scheduledAtISO: string;
        artistId: string | null;
        artistNome: string | null;
      }
    >();
    for (const a of (appts ?? []) as Array<{
      id: string;
      contact_id: string | null;
      start_at: string;
      artist_id: string | null;
      artists: { name: string | null } | null;
    }>) {
      if (!a.contact_id || byContact.has(a.contact_id)) continue;
      byContact.set(a.contact_id, {
        appointmentId: a.id,
        scheduledAtISO: a.start_at,
        artistId: a.artist_id,
        artistNome: a.artists?.name ?? null,
      });
    }

    return contacts.map((c) => ({
      contactId: c.id,
      ghlContactId: c.ghl_contact_id,
      nomeMascarado: maskNome(c.name ?? "—"),
      telefoneMascarado: maskTelefone(c.phone),
      temTelefone: Boolean(c.phone && onlyDigits(c.phone).length >= 4),
      agendamentoHoje: byContact.get(c.id) ?? null,
    }));
  });

/** Confirma os 4 últimos dígitos antes de liberar os dados do atendimento. */
export const validateTotemTelefone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ contactId: z.string().uuid(), last4: z.string().regex(/^\d{4}$/) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; session?: TotemSession }> => {
    await requireCheckinReception(context.supabase, context.userId);
    const last4 = onlyDigits(data.last4 ?? "");
    if (last4.length !== 4) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error: contactError } = await (supabaseAdmin as any)
      .from("contacts")
      .select("id, ghl_contact_id, name, phone")
      .eq("id", data.contactId)
      .maybeSingle();

    if (contactError) throw new Error("Não foi possível verificar o cliente.");
    const contact = row as {
      id: string;
      ghl_contact_id: string | null;
      name: string | null;
      phone: string | null;
    } | null;
    if (!contact) return { ok: false };

    const digits = onlyDigits(contact.phone ?? "");
    if (digits.length < 4 || digits.slice(-4) !== last4) return { ok: false };

    const { startISO, endISO } = brusselsDayBoundsISO();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: appts, error: appointmentError } = await (supabaseAdmin as any)
      .from("appointments")
      .select("id, start_at, artist_id, artists(name)")
      .eq("contact_id", contact.id)
      .gte("start_at", startISO)
      .lt("start_at", endISO)
      .in("status", ["pending", "confirmed"])
      .order("start_at", { ascending: true })
      .range(0, 99);

    if (appointmentError) throw new Error("Não foi possível verificar o agendamento.");
    const appointments = (appts ?? []) as {
      id: string;
      start_at: string;
      artist_id: string | null;
      artists: { name: string | null } | null;
    }[];
    if (appointments.length >= 100)
      throw new Error("Lista de agendamentos excedeu o limite de revisão da recepção.");
    const agendamentosHoje = appointments.map((a) => ({
      appointmentId: a.id,
      scheduledAtISO: a.start_at,
      artistId: a.artist_id,
      artistNome: a.artists?.name ?? null,
    }));

    return {
      ok: true,
      session: {
        contactId: contact.id,
        nome: contact.name ?? "—",
        telefone: contact.phone ?? null,
        ghlContactId: contact.ghl_contact_id,
        agendamentoHoje: agendamentosHoje.length === 1 ? agendamentosHoje[0] : null,
        agendamentosHoje,
      },
    };
  });

// ------------------------- totem: check-in -------------------------------

export const confirmarChegada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        nome: z.string().trim().min(2).max(160),
        telefone: z.string().max(40).nullish(),
        contactId: z.string().uuid().nullish(),
        ghlContactId: z.string().max(100).nullish(),
        appointmentId: z.string().uuid().nullish(),
        artistId: z.string().uuid().nullish(),
        scheduledAtISO: z.string().max(40).nullish(),
        consentimento: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }): Promise<CheckinCreated> => {
    await requireCheckinReception(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      from: (t: string) => any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rpc: (fn: string, args?: Record<string, unknown>) => any;
    };
    const contact = input.contactId
      ? await db
          .from("contacts")
          .select("id,name,phone,ghl_contact_id")
          .eq("id", input.contactId)
          .maybeSingle()
      : { data: null, error: null };
    const appointment = input.appointmentId
      ? await db
          .from("appointments")
          .select("id,contact_id,artist_id,start_at,status,ghl_appointment_id")
          .eq("id", input.appointmentId)
          .maybeSingle()
      : { data: null, error: null };
    if (contact.error || appointment.error)
      throw new Error("Não foi possível verificar os dados da chegada.");
    const data = canonicalCheckinInput(input, contact.data, appointment.data);
    const nome = data.nome;

    const chave = data.ghlContactId ?? data.contactId ?? data.telefone ?? null;

    // Já existe um check-in ativo hoje? Devolve o mesmo QR em vez de duplicar.
    if (chave) {
      const { startISO, endISO } = brusselsDayBoundsISO();
      let existing = db
        .from("checkins")
        .select("qr_token, codigo_atendimento, qr_url, scheduled_at, artist_id")
        .in("status", ["aguardando", "em_atendimento"])
        .gte("arrived_at", startISO)
        .lt("arrived_at", endISO)
        .limit(1);
      existing =
        data.ghlContactId != null
          ? existing.eq("ghl_contact_id", data.ghlContactId)
          : data.contactId != null
            ? existing.eq("contact_id", data.contactId)
            : existing.eq("cliente_telefone", data.telefone);
      existing = data.appointmentId
        ? existing.eq("appointment_id", data.appointmentId)
        : existing.is("appointment_id", null);
      const { data: found, error: existingError } = await existing.maybeSingle();
      if (existingError) throw new Error("Não foi possível verificar chegadas anteriores.");
      const hit = found as {
        qr_token: string;
        codigo_atendimento: string;
        qr_url: string | null;
        scheduled_at: string | null;
      } | null;
      if (hit) {
        return {
          token: hit.qr_token,
          codigo: hit.codigo_atendimento,
          qrUrl: hit.qr_url ?? `${PROD_ORIGIN}/a/${hit.qr_token}`,
          scheduledAtISO: hit.scheduled_at,
          artistNome: null,
          jaExistia: true,
        };
      }
    }

    const token = randomToken();
    const qrUrl = `${PROD_ORIGIN}/a/${token}`;
    const arrivedAt = new Date().toISOString();

    const { data: codigoData } = await db.rpc("next_checkin_codigo");
    const codigo = (typeof codigoData === "string" && codigoData) || `GF-${Date.now() % 1000}`;

    const { data: inserted, error } = await db
      .from("checkins")
      .insert({
        cliente_nome: nome,
        cliente_telefone: data.telefone ?? null,
        contact_id: data.contactId ?? null,
        ghl_contact_id: data.ghlContactId ?? null,
        appointment_id: data.appointmentId ?? null,
        artist_id: data.artistId ?? null,
        codigo_atendimento: codigo,
        status: "aguardando",
        arrived_at: arrivedAt,
        scheduled_at: data.scheduledAtISO ?? null,
        source: "Totem GF",
        qr_token: token,
        qr_url: qrUrl,
        qr_expires_at: endOfBrusselsDayISO(),
        consentimento_comunicacao: data.consentimento ?? false,
      })
      .select("id, codigo_atendimento, qr_token, qr_url, scheduled_at")
      .single();

    if (error) {
      if (error.code === "23505")
        throw new Error(
          "Já existe um registro de chegada conflitante. Confira a fila com a recepção antes de tentar novamente.",
        );
      throw new Error("Não foi possível registrar o check-in. Confira a fila com a recepção.");
    }

    const row = inserted as {
      id: string;
      codigo_atendimento: string;
      qr_token: string;
      qr_url: string;
      scheduled_at: string | null;
    };

    // CRM: best-effort. Falha aqui não invalida o check-in.
    try {
      const { syncCheckinToGhl } = await import("@/lib/checkin-ghl.server");
      const result = await syncCheckinToGhl({
        checkinId: row.id,
        clienteNome: nome,
        clienteTelefone: data.telefone ?? null,
        ghlContactId: data.ghlContactId ?? null,
        ghlAppointmentId:
          data.appointmentId && typeof appointment.data?.ghl_appointment_id === "string"
            ? appointment.data.ghl_appointment_id
            : null,
        consentimento: data.consentimento === true,
        codigoAtendimento: row.codigo_atendimento,
        qrUrl,
        arrivedAtISO: arrivedAt,
      });
      await db
        .from("checkins")
        .update({
          ghl_sync_status: result.ok ? "synced" : "failed",
          ghl_sync_error: result.ok ? null : (result.error ?? result.steps.join(" | ")),
          ghl_sync_attempts: 1,
          ghl_last_synced_at: result.ok ? new Date().toISOString() : null,
          ghl_contact_id: result.ghlContactId ?? data.ghlContactId ?? null,
          ghl_appointment_id: result.ghlAppointmentId ?? null,
          ghl_opportunity_id: result.ghlOpportunityId ?? null,
          // Workflow acceptance is not delivery evidence. Keep notificado_em untouched/null.
          // A delivery-confirmation integration must own that field.
        })
        .eq("id", row.id);
    } catch (syncError) {
      console.warn("checkin ghl sync failed", syncError);
      await db
        .from("checkins")
        .update({
          ghl_sync_status: "failed",
          ghl_sync_error: syncError instanceof Error ? syncError.message : String(syncError),
          ghl_sync_attempts: 1,
        })
        .eq("id", row.id);
    }

    return {
      token: row.qr_token,
      codigo: row.codigo_atendimento,
      qrUrl: row.qr_url,
      scheduledAtISO: row.scheduled_at,
      artistNome: null,
      jaExistia: false,
    };
  });

// ------------------------- página do cliente ----------------------------

export const getCheckinByToken = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }): Promise<CheckinPublicView | null> => {
    const token = (data.token ?? "").trim();
    if (!/^[a-f0-9]{20,64}$/.test(token)) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (supabaseAdmin as any).rpc("get_checkin_by_token", {
      p_token: token,
    });
    if (error) {
      throw new Error("Não foi possível consultar o atendimento.");
    }
    const row = (Array.isArray(rows) ? rows[0] : rows) as
      | {
          codigo_atendimento: string;
          status: CheckinStatus;
          scheduled_at: string | null;
          arrived_at: string;
          tatuador_primeiro_nome: string | null;
          expirado: boolean;
        }
      | undefined;
    if (!row) return null;

    return {
      codigo: row.codigo_atendimento,
      status: row.status,
      scheduledAtISO: row.scheduled_at,
      arrivedAtISO: row.arrived_at,
      tatuadorPrimeiroNome: row.tatuador_primeiro_nome || null,
      expirado: Boolean(row.expirado),
    };
  });

// ------------------------- fila interna ---------------------------------

export const getFilaHoje = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FilaRow[]> => {
    await requireCheckinReception(context.supabase, context.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any).rpc("list_checkins_hoje");
    if (error) {
      throw new Error("Não foi possível consultar a fila.");
    }
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      clienteNome: String(r.cliente_nome ?? "—"),
      codigo: String(r.codigo_atendimento ?? ""),
      status: r.status as CheckinStatus,
      arrivedAtISO: String(r.arrived_at),
      startedAtISO: (r.started_at as string | null) ?? null,
      scheduledAtISO: (r.scheduled_at as string | null) ?? null,
      artistId: (r.artist_id as string | null) ?? null,
      tatuador: (r.tatuador as string | null) ?? null,
      appointmentId: (r.appointment_id as string | null) ?? null,
      syncStatus:
        r.ghl_sync_status === "pending" ||
        r.ghl_sync_status === "synced" ||
        r.ghl_sync_status === "failed"
          ? r.ghl_sync_status
          : null,
    }));
  });

export const setCheckinStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum([
          "aguardando",
          "em_atendimento",
          "concluido",
          "nao_compareceu",
          "cancelado",
        ]),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await requireCheckinReception(context.supabase, context.userId);
    // The authenticated client retains RLS. Do not use the service client for queue transitions.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = context.supabase as any;
    const { data: current, error: readError } = await db
      .from("checkins")
      .select("id,status")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error("Não foi possível verificar o estado atual da fila.");
    if (!current || current.id !== data.id)
      throw new Error("Check-in não encontrado ou indisponível.");
    const patch = checkinTransitionPatch(current.status as CheckinStatus, data.status);
    const { data: updated, error } = await db
      .from("checkins")
      .update(patch)
      .eq("id", data.id)
      .eq("status", current.status)
      .select("id,status")
      .maybeSingle();
    if (error) throw new Error("Não foi possível atualizar a fila.");
    if (!updated || updated.id !== data.id || updated.status !== data.status) {
      throw new Error("A fila foi alterada por outra pessoa. Atualize antes de tentar novamente.");
    }
    return { ok: true };
  });
