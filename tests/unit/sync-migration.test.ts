import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
const db = new PGlite();
const run1 = "00000000-0000-0000-0000-000000000101",
  run2 = "00000000-0000-0000-0000-000000000102";
const artist = "00000000-0000-0000-0000-000000000201";
beforeAll(async () => {
  await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE SCHEMA cron; CREATE SCHEMA vault; CREATE SCHEMA net;
 CREATE TYPE public.user_role AS ENUM ('admin','artist','seller');
 CREATE TYPE public.appt_status AS ENUM ('pending','confirmed','cancelled','completed','no_show');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 CREATE FUNCTION public.current_user_role() RETURNS public.user_role LANGUAGE sql AS $$ SELECT nullif(current_setting('test.role',true),'')::public.user_role $$;
 CREATE FUNCTION public.current_artist_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.artist',true),'')::uuid $$;
 CREATE TABLE artists(id uuid PRIMARY KEY,active boolean,ghl_calendar_id text,commission_pct numeric);
 CREATE TABLE contacts(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,ghl_contact_id text UNIQUE,name text,phone text,email text);
 CREATE TABLE appointments(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,ghl_appointment_id text UNIQUE,ghl_contact_id text,contact_id uuid,artist_id uuid,calendar_id text,contact_name text,contact_phone text,contact_email text,start_at timestamptz,end_at timestamptz,status public.appt_status,commission_pct numeric,notes text,total_eur numeric DEFAULT 0,services jsonb DEFAULT '[]');
 ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
 GRANT SELECT ON appointments TO authenticated;
 CREATE POLICY appt_artist_select_all ON appointments FOR SELECT TO authenticated USING (current_user_role()='artist');
 CREATE POLICY own_admin ON appointments FOR SELECT TO authenticated USING (current_user_role()='admin' OR artist_id=current_artist_id());
 CREATE TABLE cron.job(jobid bigint,jobname text,schedule text,active boolean);
 CREATE TABLE vault.decrypted_secrets(name text,decrypted_secret text);
 CREATE FUNCTION cron.unschedule(bigint) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
 CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
 CREATE FUNCTION net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
 `);
  await db.exec(readFileSync("supabase/migrations/20261103160000_secure_ghl_sync.sql", "utf8"));
  await db.exec(readFileSync("docs/sql/ghl-sync-contact-identity.review.sql", "utf8"));
  await db.exec(`INSERT INTO artists VALUES('${artist}',true,'calendar-a',37);`);
  await db.exec(`INSERT INTO contacts(id,ghl_contact_id,name,phone,email) VALUES
    ('00000000-0000-0000-0000-000000000301','A','Fictional A','old','a@example.test'),
    ('00000000-0000-0000-0000-000000000302','B','Fictional B',NULL,NULL);`);
}, 30_000);
afterAll(async () => {
  await db.close();
});
it("ordinary authenticated callers cannot acquire the privileged sync lease", async () => {
  await db.exec("SET ROLE authenticated");
  await expect(db.query("SELECT ghl_sync_begin($1,'manual')", [run1])).rejects.toThrow("permission denied");
  await db.exec("RESET ROLE");
});
it("denies admin RPCs without identity, including NULL role", async () => {
  for (const fn of ["ghl_sync_status", "schedule_ghl_sync", "unschedule_ghl_sync"])
    await expect(db.query(`SELECT public.${fn}()`)).rejects.toThrow("forbidden");
  await db.exec(`SET test.uid='00000000-0000-0000-0000-000000000001'; SET test.role='';`);
  await expect(db.query("SELECT schedule_ghl_sync()")).rejects.toThrow("forbidden");
  await db.exec(`SET test.role='admin'; SET test.uid='';`);
  await expect(db.query("SELECT schedule_ghl_sync()")).rejects.toThrow("forbidden");
});
it("rejects concurrent runs; reclaims expiry and fences the previous worker", async () => {
  expect(
    (await db.query<{ ok: boolean }>("SELECT ghl_sync_begin($1,'manual') AS ok", [run1])).rows[0]
      .ok,
  ).toBe(true);
  expect(
    (await db.query<{ ok: boolean }>("SELECT ghl_sync_begin($1,'cron') AS ok", [run2])).rows[0].ok,
  ).toBe(false);
  await db.exec(`UPDATE ghl_sync_lease SET expires_at=now()-interval '1 second';`);
  expect(
    (await db.query<{ ok: boolean }>("SELECT ghl_sync_begin($1,'cron') AS ok", [run2])).rows[0].ok,
  ).toBe(true);
  await expect(db.query(`SELECT ghl_sync_write($1,'contacts','[]')`, [run1])).rejects.toThrow(
    "sync lease expired",
  );
  expect(
    (await db.query<{ status: string }>("SELECT status FROM ghl_sync_runs WHERE id=$1", [run1]))
      .rows[0].status,
  ).toBe("expired");
});
it("preserves existing financial amounts and configured commission on updates", async () => {
  const rows = [
    {
      ghl_appointment_id: "fake-event",
      ghl_contact_id: "A",
      contact_id: "00000000-0000-0000-0000-000000000301",
      contact_name: "Fictional A",
      contact_phone: "old",
      contact_email: "a@example.test",
      artist_id: artist,
      calendar_id: "calendar-a",
      commission_pct: 37,
      status: "pending",
      start_at: "2026-11-03T12:00:00Z",
      end_at: "2026-11-03T13:00:00Z",
    },
  ];
  await db.query(`SELECT ghl_sync_write($1,'insert',$2)`, [run2, JSON.stringify(rows)]);
  await db.exec(`UPDATE appointments SET total_eur=650,services='[{"name":"fictional"}]';`);
  await db.query(`SELECT ghl_sync_write($1,'update',$2)`, [
    run2,
    JSON.stringify([{ ...rows[0], status: "confirmed", commission_pct: 99, total_eur: 0 }]),
  ]);
  const row = (
    await db.query<{ total_eur: string; commission_pct: string; status: string }>(
      "SELECT total_eur,commission_pct,status FROM appointments",
    )
  ).rows[0];
  expect(Number(row.total_eur)).toBe(650);
  expect(Number(row.commission_pct)).toBe(37);
  expect(row.status).toBe("confirmed");
});
it("rejects ownership changes before writing", async () => {
  await expect(
    db.query(`SELECT ghl_sync_write($1,'update',$2)`, [
      run2,
      JSON.stringify([
        { ghl_appointment_id: "fake-event", artist_id: artist, calendar_id: "other", ghl_contact_id: "A", contact_id: "00000000-0000-0000-0000-000000000301", contact_name: "Fictional A", contact_phone: "old", contact_email: "a@example.test" },
      ]),
    ]),
  ).rejects.toThrow("event ownership conflict");
});
it("partial failures never advance the successful completion time", async () => {
  const before = (await db.query("SELECT * FROM appointments WHERE ghl_appointment_id='fake-event'")).rows;
  for (const identity of [
    { ghl_contact_id: "B", contact_id: null, contact_name: "Fictional B" },
    { ghl_contact_id: "B", contact_id: "00000000-0000-0000-0000-000000000301", contact_name: "Fictional A", contact_phone: "old", contact_email: "a@example.test" },
    { ghl_contact_id: "B", contact_id: "00000000-0000-0000-0000-000000000302", contact_name: "Fictional B", contact_email: "a@example.test" },
  ]) {
    for (const kind of ['insert', 'update']) {
      await expect(db.query("SELECT ghl_sync_write($1,$2,$3)", [run2, kind, JSON.stringify([{ ghl_appointment_id: "fake-event", artist_id: artist, calendar_id: "calendar-a", ...identity }])])).rejects.toThrow("contact identity conflict");
      expect((await db.query("SELECT * FROM appointments WHERE ghl_appointment_id='fake-event'")).rows).toEqual(before);
    }
  }
  // A valid A→B transition replaces the whole snapshot, including null fields.
  await db.query("SELECT ghl_sync_write($1,'update',$2)", [run2, JSON.stringify([{
    ghl_appointment_id: "fake-event", artist_id: artist, calendar_id: "calendar-a",
    ghl_contact_id: "B", contact_id: "00000000-0000-0000-0000-000000000302", contact_name: "Fictional B", contact_phone: null, contact_email: null,
    status: "confirmed", start_at: "2026-11-03T12:00:00Z", end_at: "2026-11-03T13:00:00Z",
  }])]);
  expect((await db.query("SELECT ghl_contact_id,contact_id,contact_name,contact_phone,contact_email,total_eur,commission_pct FROM appointments WHERE ghl_appointment_id='fake-event'")).rows[0]).toMatchObject({
    ghl_contact_id: "B", contact_id: "00000000-0000-0000-0000-000000000302", contact_name: "Fictional B", contact_phone: null, contact_email: null, total_eur: "650", commission_pct: "37",
  });
  await db.query("SELECT ghl_sync_finish($1,$2)", [
    run2,
    JSON.stringify({ ok: false, failures: 1 }),
  ]);
  await db.exec(`SET test.uid='00000000-0000-0000-0000-000000000001'; SET test.role='admin';`);
  const status = (
    await db.query<{ s: { last_success_at: string | null; latest_status: string } }>(
      "SELECT ghl_sync_status() AS s",
    )
  ).rows[0].s;
  expect(status.last_success_at).toBeNull();
  expect(status.latest_status).toBe("failed");
});
it("artists read only their own rows; administrators preserve access", async () => {
  await db.exec(
    `INSERT INTO appointments(artist_id) VALUES('00000000-0000-0000-0000-000000000999'); SET test.artist='${artist}'; SET test.role='artist'; SET ROLE authenticated;`,
  );
  expect((await db.query("SELECT id FROM appointments")).rows).toHaveLength(1);
  await db.exec(`SET test.role='admin';`);
  expect((await db.query("SELECT id FROM appointments")).rows).toHaveLength(2);
  await db.exec("RESET ROLE");
});
