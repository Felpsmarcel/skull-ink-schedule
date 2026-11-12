// Review SQL only, executed against a disposable in-memory PGlite database. Never production.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

const db = new PGlite();
const ADMIN = "00000000-0000-4000-8000-000000000001";
const CONTACT = "00000000-0000-4000-8000-000000000010";
const APPT_A = "00000000-0000-4000-8000-000000000011";
const APPT_B = "00000000-0000-4000-8000-000000000012";
const CHECKIN_A = "00000000-0000-4000-8000-000000000021";
const CHECKIN_B = "00000000-0000-4000-8000-000000000022";

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TYPE public.user_role AS ENUM ('admin','artist','seller');
    CREATE TYPE public.movimentacao_sync_status AS ENUM ('pending','synced','failed');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION public.current_user_role() RETURNS public.user_role LANGUAGE sql AS $$ SELECT nullif(current_setting('test.role',true),'')::public.user_role $$;
    CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
    CREATE TABLE public.contacts(id uuid PRIMARY KEY);
    CREATE TABLE public.artists(id uuid PRIMARY KEY,name text);
    CREATE TABLE public.appointments(id uuid PRIMARY KEY);
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    INSERT INTO public.contacts VALUES ('${CONTACT}');
    INSERT INTO public.appointments VALUES ('${APPT_A}'),('${APPT_B}');
  `);
  await db.exec(
    readFileSync(
      "supabase/migrations/20260810151049_537ceac1-9afe-42d4-b86c-85a605bd5d30.sql",
      "utf8",
    ),
  );
  // Confirm the proposed restrictive fence still works if another broad policy survives inventory.
  await db.exec(
    "CREATE POLICY overlooked_broad_read ON public.checkins FOR SELECT TO authenticated USING(true);",
  );
  const review = readFileSync("docs/sql/checkin-access.review.sql", "utf8");
  expect(review.trim().endsWith("ROLLBACK;")).toBe(true);
  await db.exec(review.replace(/ROLLBACK;\s*$/, "COMMIT;"));
}, 30_000);
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec(`RESET ROLE; SET test.uid=''; SET test.role=''; TRUNCATE public.checkins;
    INSERT INTO public.checkins(id,cliente_nome,contact_id,appointment_id,codigo_atendimento,qr_token)
    VALUES ('${CHECKIN_A}','Pessoa Exemplo','${CONTACT}','${APPT_A}','DEMO-01','synthetic-a'),
           ('${CHECKIN_B}','Pessoa Exemplo','${CONTACT}','${APPT_B}','DEMO-02','synthetic-b');`);
});
async function as(role: string | null, sqlRole = "authenticated") {
  await db.exec(
    `RESET ROLE; SET test.uid='${role ? ADMIN : ""}'; SET test.role='${role ?? ""}'; SET ROLE ${sqlRole};`,
  );
}

describe("check-in access SQL proposal", () => {
  it.each(["artist", "seller", null])(
    "denies %s table and RPC reads even with an overlooked permissive policy",
    async (role) => {
      await as(role);
      expect((await db.query("SELECT id FROM public.checkins")).rows).toEqual([]);
      await expect(db.query("SELECT * FROM public.list_checkins_hoje()")).rejects.toThrow(
        "forbidden",
      );
      expect(
        (await db.query("UPDATE public.checkins SET status='cancelado' RETURNING id")).rows,
      ).toEqual([]);
    },
  );
  it("denies anonymous reads, inserts and RPC execution", async () => {
    await as(null, "anon");
    await expect(db.query("SELECT id FROM public.checkins")).rejects.toThrow(/permission denied/);
    await expect(db.query("SELECT * FROM public.list_checkins_hoje()")).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.query("INSERT INTO public.checkins DEFAULT VALUES")).rejects.toThrow(
      /permission denied/,
    );
  });
  it("admin reads the queue but cannot forge identity columns or directly insert", async () => {
    await as("admin");
    expect((await db.query("SELECT * FROM public.list_checkins_hoje()")).rows).toHaveLength(2);
    await expect(db.query("UPDATE public.checkins SET appointment_id=null")).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.query("INSERT INTO public.checkins DEFAULT VALUES")).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.query("DELETE FROM public.checkins")).rejects.toThrow(/permission denied/);
  });
  it("keeps distinct appointments for the same client and refuses a duplicate of one appointment", async () => {
    expect(
      (await db.query("SELECT appointment_id FROM public.checkins ORDER BY appointment_id")).rows,
    ).toEqual([{ appointment_id: APPT_A }, { appointment_id: APPT_B }]);
    await expect(
      db.query(
        `INSERT INTO public.checkins(cliente_nome,contact_id,appointment_id,codigo_atendimento,qr_token) VALUES ('Pessoa Exemplo','${CONTACT}','${APPT_A}','DEMO-03','synthetic-duplicate')`,
      ),
    ).rejects.toThrow(/duplicate key/);
    // No appointment is a separate walk-in bucket, never silently merged with appointment A or B.
    await db.query(
      `INSERT INTO public.checkins(cliente_nome,contact_id,codigo_atendimento,qr_token) VALUES ('Pessoa Exemplo','${CONTACT}','DEMO-04','synthetic-walkin')`,
    );
    expect((await db.query("SELECT id FROM public.checkins")).rows).toHaveLength(3);
  });
  it("compare-and-set permits only one writer to consume the observed waiting status", async () => {
    await as("admin");
    const sql =
      "UPDATE public.checkins SET status='em_atendimento',started_at=now() WHERE id=$1 AND status='aguardando' RETURNING id";
    expect((await db.query(sql, [CHECKIN_A])).rows).toHaveLength(1);
    expect((await db.query(sql, [CHECKIN_A])).rows).toHaveLength(0);
  });
  it("queue excludes the next Brussels midnight and keeps tokens/IDs intact", async () => {
    await db.query(
      `UPDATE public.checkins SET arrived_at=(((now() AT TIME ZONE 'Europe/Brussels')::date + 1)::timestamp AT TIME ZONE 'Europe/Brussels') WHERE id='${CHECKIN_B}'`,
    );
    await as("admin");
    expect(
      (await db.query<{ id: string }>("SELECT * FROM public.list_checkins_hoje()")).rows.map(
        (row) => row.id,
      ),
    ).toEqual([CHECKIN_A]);
    expect(
      (
        await db.query<{ qr_token: string; appointment_id: string }>(
          "SELECT qr_token,appointment_id FROM public.checkins WHERE id=$1",
          [CHECKIN_B],
        )
      ).rows[0],
    ).toEqual({ qr_token: "synthetic-b", appointment_id: APPT_B });
  });
});
