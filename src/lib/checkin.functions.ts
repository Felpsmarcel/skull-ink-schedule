import { createServerFn } from "@tanstack/react-start";
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
  syncStatus: "pending" | "synced" | "failed";
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
  if (!telefone) return null;
  const digits = onlyDigits(telefone);
  if (digits.length < 4) return "••••";
  return `•••• ${digits.slice(-4)}`;
}

function endOfBrusselsDayISO(): string {
  const now = new Date();
  const key = now.toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" });
  return new Date(`${key}T23:59:59+02:00`).toISOString();
}

function brusselsDayBoundsISO() {
  const key = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" });
  return {
    startISO: new Date(`${key}T00:00:00+02:00`).toISOString(),
    endISO: new Date(`${key}T23:59:59+02:00`).toISOString(),
  };
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ------------------------- totem: busca ----------------------------------

export const searchTotemClientes = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string }) => input)
  .handler(async ({ data }): Promise<TotemCandidate[]> => {
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
      console.warn("totem search failed", error.message);
      return [];
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
    const { data: appts } = await (supabaseAdmin as any)
      .from("appointments")
      .select("id, contact_id, start_at, artist_id, artists(name)")
      .in(
        "contact_id",
        contacts.map((c) => c.id),
      )
      .gte("start_at", startISO)
      .lte("start_at", endISO)
      .order("start_at", { ascending: true });

    const byContact = new Map<
      string,
      { appointmentId: string; scheduledAtISO: string; artistId: string | null; artistNome: string | null }
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
  .inputValidator((input: { contactId: string; last4: string }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean; session?: TotemSession }> => {
    const last4 = onlyDigits(data.last4 ?? "");
    if (last4.length !== 4) return { ok: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row } = await (supabaseAdmin as any)
      .from("contacts")
      .select("id, ghl_contact_id, name, phone")
      .eq("id", data.contactId)
      .maybeSingle();

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
    const { data: appt } = await (supabaseAdmin as any)
      .from("appointments")
      .select("id, start_at, artist_id, artists(name)")
      .eq("contact_id", contact.id)
      .gte("start_at", startISO)
      .lte("start_at", endISO)
      .order("start_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const a = appt as {
      id: string;
      start_at: string;
      artist_id: string | null;
      artists: { name: string | null } | null;
    } | null;

    return {
      ok: true,
      session: {
        contactId: contact.id,
        nome: contact.name ?? "—",
        telefone: contact.phone ?? null,
        ghlContactId: contact.ghl_contact_id,
        agendamentoHoje: a
          ? {
              appointmentId: a.id,
              scheduledAtISO: a.start_at,
              artistId: a.artist_id,
              artistNome: a.artists?.name ?? null,
            }
          : null,
      },
    };
  });

// ------------------------- totem: check-in -------------------------------

export const confirmarChegada = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      nome: string;
      telefone?: string | null;
      contactId?: string | null;
      ghlContactId?: string | null;
      appointmentId?: string | null;
      artistId?: string | null;
      scheduledAtISO?: string | null;
      consentimento?: boolean;
    }) => input,
  )
  .handler(async ({ data }): Promise<CheckinCreated> => {
    const nome = (data.nome ?? "").trim();
    if (nome.length < 2) throw new Error("Nome inválido");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      from: (t: string) => any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rpc: (fn: string, args?: Record<string, unknown>) => any;
    };

    const chave = data.ghlContactId ?? data.contactId ?? (data.telefone ?? null);

    // Já existe um check-in ativo hoje? Devolve o mesmo QR em vez de duplicar.
    if (chave) {
      const { startISO, endISO } = brusselsDayBoundsISO();
      let existing = db
        .from("checkins")
        .select("qr_token, codigo_atendimento, qr_url, scheduled_at, artist_id")
        .in("status", ["aguardando", "em_atendimento"])
        .gte("arrived_at", startISO)
        .lte("arrived_at", endISO)
        .limit(1);
      existing =
        data.ghlContactId != null
          ? existing.eq("ghl_contact_id", data.ghlContactId)
          : data.contactId != null
            ? existing.eq("contact_id", data.contactId)
            : existing.eq("cliente_telefone", data.telefone);
      const { data: found } = await existing.maybeSingle();
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

    if (error) throw new Error(`Não foi possível registar o check-in: ${error.message}`);

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
          // O envio ao cliente é feito pelo workflow do CRM, e só com consentimento.
          notificado_em:
            data.consentimento && result.workflowTriggered ? new Date().toISOString() : null,
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
      console.warn("get_checkin_by_token failed", error.message);
      return null;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any).rpc("list_checkins_hoje");
    if (error) {
      console.warn("list_checkins_hoje failed", error.message);
      return [];
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
      syncStatus: (r.ghl_sync_status as "pending" | "synced" | "failed") ?? "pending",
    }));
  });

export const setCheckinStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: CheckinStatus }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "em_atendimento") patch.started_at = new Date().toISOString();
    if (data.status === "concluido") patch.finished_at = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from("checkins")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
