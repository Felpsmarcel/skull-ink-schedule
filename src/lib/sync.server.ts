/**
 * Backfill GHL appointments into the local `appointments` table.
 * Server-only — never import from a client module or a `.functions.ts` file
 * at module scope.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-04-15";

export interface SyncResult {
  ok: boolean;
  scannedCalendars: number;
  fetchedEvents: number;
  inserted: number;
  updated: number;
  failures: number;
  errors: string[];
}

interface GhlEvent {
  id: string;
  calendarId?: string;
  contactId?: string;
  title?: string;
  appointmentStatus?: string;
  startTime: string;
  endTime: string;
  contact?: { id?: string; name?: string; firstName?: string; lastName?: string };
}

interface ArtistRow {
  id: string;
  ghl_calendar_id: string | null;
  active: boolean;
  commission_pct: number | string | null;
}

function mapStatus(s: string | undefined): string {
  switch ((s ?? "").toLowerCase()) {
    case "confirmed":
      return "confirmed";
    case "showed":
    case "completed":
      return "completed";
    case "noshow":
    case "no_show":
      return "no_show";
    case "cancelled":
    case "invalid":
      return "cancelled";
    case "new":
    case "pending":
    default:
      return "pending";
  }
}

async function ghlGetEvents(
  calendarId: string,
  locationId: string,
  startMs: number,
  endMs: number,
  token: string,
): Promise<{ ok: boolean; status: number; events: GhlEvent[]; raw: unknown }> {
  const url = new URL(`${GHL_BASE}/calendars/events`);
  url.searchParams.set("calendarId", calendarId);
  url.searchParams.set("locationId", locationId);
  url.searchParams.set("startTime", String(startMs));
  url.searchParams.set("endTime", String(endMs));
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: GHL_VERSION,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let raw: unknown = null;
  try {
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = text;
  }
  const events = (raw as { events?: GhlEvent[] } | null)?.events ?? [];
  return { ok: res.ok, status: res.status, events, raw };
}

export interface GhlContactInfo {
  name: string | null;
  phone: string | null;
  email: string | null;
}

/**
 * The calendar events endpoint only returns the contact ID — never the name.
 * Fetch the contact record itself so client details land in the database.
 */
async function ghlGetContact(
  contactId: string,
  token: string,
): Promise<GhlContactInfo | null> {
  try {
    const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: "2021-07-28",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as {
      contact?: {
        contactName?: string;
        name?: string;
        firstName?: string;
        lastName?: string;
        phone?: string;
        email?: string;
      };
    };
    const c = raw?.contact;
    if (!c) return null;
    const name =
      c.contactName?.trim() ||
      c.name?.trim() ||
      [c.firstName, c.lastName].filter(Boolean).join(" ").trim() ||
      null;
    return {
      name,
      phone: c.phone?.trim() || null,
      email: c.email?.trim() || null,
    };
  } catch {
    return null;
  }
}

/** Resolve many contacts with a per-run cache and bounded concurrency. */
async function resolveContacts(
  ids: string[],
  token: string,
  cache: Map<string, GhlContactInfo | null>,
): Promise<void> {
  const pending = ids.filter((id) => !cache.has(id));
  const CONCURRENCY = 5;
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const slice = pending.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map((id) => ghlGetContact(id, token)));
    slice.forEach((id, idx) => cache.set(id, results[idx] ?? null));
  }
}

export async function syncGhlAppointments(opts?: {
  pastDays?: number;
  futureDays?: number;
  locationId?: string;
}): Promise<SyncResult> {
  const token = process.env.GHL_TOKEN;
  if (!token) throw new Error("GHL_TOKEN ausente no servidor");
  const locationId = opts?.locationId ?? "9iqrKUVPDddINb9S4Iwd";
  const pastDays = opts?.pastDays ?? 7;
  const futureDays = opts?.futureDays ?? 90;

  const now = Date.now();
  const startMs = now - pastDays * 86_400_000;
  const endMs = now + futureDays * 86_400_000;

  const errors: string[] = [];
  let fetched = 0;
  let inserted = 0;
  let updated = 0;
  let failures = 0;

  const { data: artistsData, error: artistsErr } = await supabaseAdmin
    .from("artists" as never)
    .select("id, ghl_calendar_id, active, commission_pct")
    .eq("active", true);
  if (artistsErr) throw new Error(`artists: ${artistsErr.message}`);
  const artists = ((artistsData ?? []) as ArtistRow[]).filter(
    (a) => a.ghl_calendar_id,
  );

  // Same client shows up across calendars/events — cache per run.
  const contactInfo = new Map<string, GhlContactInfo | null>();

  for (const artist of artists) {
    const calId = artist.ghl_calendar_id!;
    const artistCommissionPct = Number(artist.commission_pct ?? 40);
    const res = await ghlGetEvents(calId, locationId, startMs, endMs, token);
    if (!res.ok) {
      const reason = `GHL events ${res.status} cal=${calId}`;
      errors.push(reason);
      await supabaseAdmin.from("ghl_sync_failures" as never).insert({
        ghl_event_id: null,
        reason,
        payload: { calendarId: calId, raw: res.raw },
      } as never);
      failures++;
      continue;
    }
    fetched += res.events.length;
    if (res.events.length === 0) continue;

    // Ensure a contacts row exists for every event that carries a GHL contact.
    // Without this, appointments.contact_id stays NULL and payments (which
    // require contact_id NOT NULL) cannot be recorded.
    const contactIdMap = new Map<string, string>(); // ghl_contact_id -> contacts.id
    const contactUpserts: Array<{
      ghl_contact_id: string;
      name: string;
      email: string | null;
      phone: string | null;
    }> = [];
    const seenGhl = new Set<string>();
    for (const e of res.events) {
      const gid = e.contactId ?? e.contact?.id;
      if (!gid || seenGhl.has(gid)) continue;
      seenGhl.add(gid);
    }
    await resolveContacts([...seenGhl], token, contactInfo);
    for (const gid of seenGhl) {
      const info = contactInfo.get(gid) ?? null;
      contactUpserts.push({
        ghl_contact_id: gid,
        name: info?.name ?? "Sem nome",
        email: info?.email ?? null,
        phone: info?.phone ?? null,
      });
    }
    void ((
      e: GhlEvent,
    ) =>
        e.contact?.name?.trim() ||
        [e.contact?.firstName, e.contact?.lastName].filter(Boolean).join(" ").trim() ||
        "Sem nome");
    if (contactUpserts.length > 0) {
      const { data: cRows, error: cErr } = await supabaseAdmin
        .from("contacts" as never)
        .upsert(contactUpserts as never, {
          onConflict: "ghl_contact_id",
          ignoreDuplicates: false,
        })
        .select("id, ghl_contact_id");
      if (cErr) {
        errors.push(`contacts upsert: ${cErr.message}`);
      } else {
        for (const r of (cRows ?? []) as Array<{ id: string; ghl_contact_id: string }>) {
          contactIdMap.set(r.ghl_contact_id, r.id);
        }
      }
      // Fallback: fetch any that upsert.select didn't return.
      const missing = contactUpserts
        .map((c) => c.ghl_contact_id)
        .filter((g) => !contactIdMap.has(g));
      if (missing.length > 0) {
        const { data: fetchRows } = await supabaseAdmin
          .from("contacts" as never)
          .select("id, ghl_contact_id")
          .in("ghl_contact_id", missing);
        for (const r of (fetchRows ?? []) as Array<{
          id: string;
          ghl_contact_id: string;
        }>) {
          contactIdMap.set(r.ghl_contact_id, r.id);
        }
      }
    }

    // Concurrent runs (cron + manual admin click) can race the read-then-insert
    // pattern and trip the unique index on ghl_appointment_id. Split into:
    //   - upsert(ignoreDuplicates) for net-new rows: safe under concurrency, and
    //     critically NEVER touches existing financial fields.
    //   - explicit UPDATE per existing row: refreshes only non-financial fields.
    const ids = res.events.map((e) => e.id);
    const { data: existingRows, error: existingErr } = await supabaseAdmin
      .from("appointments" as never)
      .select("ghl_appointment_id")
      .in("ghl_appointment_id", ids);
    if (existingErr) {
      errors.push(`select existing: ${existingErr.message}`);
      failures++;
      continue;
    }
    const existing = new Set(
      ((existingRows ?? []) as Array<{ ghl_appointment_id: string }>).map(
        (r) => r.ghl_appointment_id,
      ),
    );

    const toInsert = res.events.filter((e) => !existing.has(e.id));
    const toUpdate = res.events.filter((e) => existing.has(e.id));

    if (toInsert.length > 0) {
      const rows = toInsert.map((e) => ({
        ghl_appointment_id: e.id,
        ghl_contact_id: e.contactId ?? null,
        contact_id:
          (e.contactId && contactIdMap.get(e.contactId)) ??
          (e.contact?.id && contactIdMap.get(e.contact.id)) ??
          null,
        artist_id: artist.id,
        calendar_id: calId,
        contact_name:
          e.contact?.name ??
          ([e.contact?.firstName, e.contact?.lastName].filter(Boolean).join(" ") || null),
        start_at: e.startTime,
        end_at: e.endTime,
        status: mapStatus(e.appointmentStatus),
        // Resolve commission from the artist so financial rollups never see NULL
        // for events created directly in GHL (outside the app's checkout flow).
        commission_pct: artistCommissionPct,
        notes: e.title ?? null,
      }));
      // ignoreDuplicates: another concurrent run may have inserted between our
      // SELECT and INSERT. Treat that as a no-op, not a batch failure.
      const { error: insErr, count } = await supabaseAdmin
        .from("appointments" as never)
        .upsert(rows as never, {
          onConflict: "ghl_appointment_id",
          ignoreDuplicates: true,
          count: "exact",
        });
      if (insErr) {
        errors.push(`upsert: ${insErr.message}`);
        await supabaseAdmin.from("ghl_sync_failures" as never).insert({
          ghl_event_id: null,
          reason: `bulk upsert failed: ${insErr.message}`,
          payload: { calendarId: calId, eventIds: toInsert.map((e) => e.id) },
        } as never);
        failures += toInsert.length;
      } else {
        inserted += count ?? rows.length;
      }
    }

    for (const e of toUpdate) {
      // Only refresh non-sensitive fields. NEVER overwrite total_eur,
      // commission_pct, or services — those belong to checkout.
      const linkedContactId =
        (e.contactId && contactIdMap.get(e.contactId)) ??
        (e.contact?.id && contactIdMap.get(e.contact.id)) ??
        null;
      const { error: upErr } = await supabaseAdmin
        .from("appointments" as never)
        .update(
          {
            start_at: e.startTime,
            end_at: e.endTime,
            status: mapStatus(e.appointmentStatus),
            contact_name:
              e.contact?.name ??
              ([e.contact?.firstName, e.contact?.lastName].filter(Boolean).join(" ") || null),
            ghl_contact_id: e.contactId ?? null,
            ...(linkedContactId ? { contact_id: linkedContactId } : {}),
            calendar_id: calId,
          } as never,
        )
        .eq("ghl_appointment_id", e.id);
      if (upErr) {
        errors.push(`update ${e.id}: ${upErr.message}`);
        failures++;
      } else {
        updated++;
      }
    }
  }

  return {
    ok: failures === 0,
    scannedCalendars: artists.length,
    fetchedEvents: fetched,
    inserted,
    updated,
    failures,
    errors: errors.slice(0, 20),
  };
}