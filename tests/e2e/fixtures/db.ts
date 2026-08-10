import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Prefixo usado em todos os registos criados pelos testes, para limpeza segura. */
export const E2E_PREFIX = "E2E-";

export function admin(): SupabaseClient {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente de testes.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function uniqueName(label: string) {
  return `${E2E_PREFIX}${label} ${Date.now().toString().slice(-6)}`;
}

/** Início/fim do dia atual em Bruxelas, igual ao usado pelas server functions. */
export function brusselsDayBounds() {
  const key = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" });
  return {
    startISO: new Date(`${key}T00:00:00+02:00`).toISOString(),
    endISO: new Date(`${key}T23:59:59+02:00`).toISOString(),
  };
}

export interface SeededClient {
  contactId: string;
  ghlContactId: string;
  nome: string;
  telefone: string;
  last4: string;
  appointmentId?: string;
  artistNome?: string;
}

/** Cria um contacto de teste e, opcionalmente, um agendamento para hoje. */
export async function seedClient(
  db: SupabaseClient,
  opts: { withAppointmentToday?: boolean } = {},
): Promise<SeededClient> {
  const nome = uniqueName("Cliente Totem");
  const last4 = String(Math.floor(1000 + Math.random() * 8999));
  const telefone = `+3247100${last4}`;
  const ghlContactId = `e2e-${crypto.randomUUID()}`;

  const { data: contact, error } = await db
    .from("contacts")
    .insert({ ghl_contact_id: ghlContactId, name: nome, phone: telefone })
    .select("id")
    .single();
  if (error) throw new Error(`falha ao criar contacto de teste: ${error.message}`);

  const seeded: SeededClient = { contactId: contact.id as string, ghlContactId, nome, telefone, last4 };

  if (opts.withAppointmentToday) {
    const { data: artist, error: aerr } = await db
      .from("artists")
      .select("id, name")
      .eq("active", true)
      .limit(1)
      .single();
    if (aerr) throw new Error(`nenhum tatuador ativo para o teste: ${aerr.message}`);

    const { startISO } = brusselsDayBounds();
    const start = new Date(new Date(startISO).getTime() + 15 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const { data: appt, error: apperr } = await db
      .from("appointments")
      .insert({
        contact_id: seeded.contactId,
        artist_id: artist.id,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        status: "confirmed",
        contact_name: nome,
        contact_phone: telefone,
      })
      .select("id")
      .single();
    if (apperr) throw new Error(`falha ao criar agendamento de teste: ${apperr.message}`);

    seeded.appointmentId = appt.id as string;
    seeded.artistNome = artist.name as string;
  }

  return seeded;
}

/** Remove tudo o que os testes criaram (check-ins, agendamentos, contactos). */
export async function cleanup(db: SupabaseClient) {
  await db.from("checkins").update({ status: "cancelado" }).like("cliente_nome", `${E2E_PREFIX}%`);
  await db.from("checkins").delete().like("cliente_nome", `${E2E_PREFIX}%`);
  await db.from("appointments").delete().like("contact_name", `${E2E_PREFIX}%`);
  await db.from("contacts").delete().like("name", `${E2E_PREFIX}%`);
}
