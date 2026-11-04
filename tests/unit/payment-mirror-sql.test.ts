// Local disposable PGlite with the current schema shape of the involved tables + auth stubs.
// Never touches the real database.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, expect, it, describe } from "vitest";

const db = new PGlite();
const ADMIN = "00000000-0000-0000-0000-00000000a001";
const ARTIST = "00000000-0000-0000-0000-00000000a002";
const PA = "00000000-0000-0000-0000-0000000000a1", PB = "00000000-0000-0000-0000-0000000000b1", PA2 = "00000000-0000-0000-0000-0000000000a2";
const CA = "00000000-0000-0000-0000-0000000000ca", CB = "00000000-0000-0000-0000-0000000000cb";
const APA = "00000000-0000-0000-0000-00000000aa01", APB = "00000000-0000-0000-0000-00000000bb01", APA2 = "00000000-0000-0000-0000-00000000aa02";
const PAY1 = "00000000-0000-0000-0000-000000000901", PAYB = "00000000-0000-0000-0000-000000000902", PAY3 = "00000000-0000-0000-0000-000000000903", PAY4 = "00000000-0000-0000-0000-000000000904";
const MOV1 = "00000000-0000-0000-0000-000000000801", MOVX = "00000000-0000-0000-0000-000000000802";
const NOPE = "00000000-0000-0000-0000-000000000999";

async function as(uid: string | null, role: string | null) {
  await db.exec(`RESET ROLE; SET test.uid='${uid ?? ""}'; SET test.role='${role ?? ""}';`);
}
const one = async <T>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];

beforeAll(async () => {
  await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth;
  CREATE TYPE public.user_role AS ENUM ('admin','artist','seller');
  CREATE TYPE public.payment_method AS ENUM ('cash','card','transfer','payconiq','other');
  CREATE TYPE public.payment_status AS ENUM ('pending','paid','refunded');
  CREATE TYPE public.payment_type AS ENUM ('deposit','final','refund');
  CREATE TYPE public.movimentacao_tipo AS ENUM ('sinal','sessao','saldo','produto','estorno');
  CREATE TYPE public.forma_pagamento_enum AS ENUM ('cartao','dinheiro','sumup','transferencia');
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
  CREATE FUNCTION public.current_user_role() RETURNS public.user_role LANGUAGE sql AS $$ SELECT nullif(current_setting('test.role',true),'')::public.user_role $$;
  CREATE TABLE public.app_settings(key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.contacts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ghl_contact_id text NOT NULL UNIQUE, name text NOT NULL, email text, phone text);
  CREATE TABLE public.tattoo_projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ghl_contact_id text, ghl_opportunity_id text, contact_id uuid,
    title text NOT NULL, quoted_total_eur numeric NOT NULL DEFAULT 0, deposit_eur numeric NOT NULL DEFAULT 0);
  CREATE TABLE public.appointments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid REFERENCES public.tattoo_projects(id),
    contact_id uuid NOT NULL REFERENCES public.contacts(id), ghl_contact_id text);
  CREATE TABLE public.payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), appointment_id uuid REFERENCES public.appointments(id),
    contact_id uuid NOT NULL REFERENCES public.contacts(id), amount_eur numeric NOT NULL, type public.payment_type NOT NULL,
    method public.payment_method NOT NULL, status public.payment_status NOT NULL, paid_at timestamptz);
  CREATE TABLE public.movimentacoes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid,
    appointment_id uuid REFERENCES public.appointments(id), ghl_contact_id text, data_pagamento date NOT NULL,
    tipo_movimento public.movimentacao_tipo NOT NULL, valor_cartao numeric NOT NULL DEFAULT 0, valor_dinheiro numeric NOT NULL DEFAULT 0,
    valor_sumup numeric NOT NULL DEFAULT 0, valor_transferencia numeric NOT NULL DEFAULT 0,
    total numeric GENERATED ALWAYS AS (valor_cartao + valor_dinheiro + valor_sumup + valor_transferencia) STORED,
    forma_pagamento public.forma_pagamento_enum, deleted_at timestamptz);
  `);
  await db.exec(readFileSync("docs/sql/payment-mirror-outbox.review.sql", "utf8"));
}, 30_000);
afterAll(async () => { await db.close(); });

beforeEach(async () => {
  await db.exec(`RESET ROLE;
   TRUNCATE public.payment_receipt_refunds, public.payment_mirror_project_locks, public.payment_mirror_outbox,
     public.payment_receipt_sources, public.project_invoice_links, public.payment_receipts, public.payments,
     public.movimentacoes, public.appointments, public.tattoo_projects, public.contacts CASCADE;
   INSERT INTO public.contacts(id, ghl_contact_id, name) VALUES ('${CA}','gA','Fict A'),('${CB}','gB','Fict B');
   INSERT INTO public.tattoo_projects(id, ghl_contact_id, title, quoted_total_eur) VALUES ('${PA}','gA','Braço',600),('${PA2}','gA','Perna',300),('${PB}','gB','Costas',900);
   INSERT INTO public.appointments(id, project_id, contact_id, ghl_contact_id) VALUES
     ('${APA}','${PA}','${CA}','gA'),('${APB}','${PB}','${CB}','gB'),('${APA2}','${PA2}','${CA}','gA');
   INSERT INTO public.payments(id, appointment_id, contact_id, amount_eur, type, method, status, paid_at) VALUES
     ('${PAY1}','${APA}','${CA}',150,'deposit','cash','paid','2026-10-05T10:00:00Z'),
     ('${PAYB}','${APA}','${CB}',100,'final','card','paid','2026-10-06T10:00:00Z'),
     ('${PAY3}','${APA}','${CA}',200,'final','card','paid','2026-10-07T10:00:00Z'),
     ('${PAY4}','${APA2}','${CA}',50,'final','card','paid','2026-10-07T10:00:00Z');
   INSERT INTO public.movimentacoes(id, project_id, appointment_id, ghl_contact_id, data_pagamento, tipo_movimento, valor_dinheiro, forma_pagamento) VALUES
     ('${MOV1}','${PA}','${APA}','gA','2026-10-05','sinal',150,'dinheiro'),
     ('${MOVX}','${PA}','${APA}','gA','2026-10-09','sessao',999,'dinheiro');`);
});

const confirm = (src: string, id: string, extra: unknown[] = [null, null, null]) =>
  db.query<{ r: string }>("SELECT public.confirm_receipt($1,$2,$3,$4,$5) AS r", [src, id, ...extra]);

describe("confirm_receipt", () => {
  it("authorization: no identity, artist and unknown role are denied; nothing changes", async () => {
    await as(null, null); await expect(confirm("payment", PAY1)).rejects.toThrow("forbidden");
    await as(ARTIST, "artist"); await expect(confirm("payment", PAY1)).rejects.toThrow("forbidden");
    await as(ADMIN, null); await expect(confirm("payment", PAY1)).rejects.toThrow("forbidden");
    await as(null, null);
    expect((await one<{ n: number }>("SELECT count(*)::int n FROM payment_mirror_outbox")).n).toBe(0);
    expect((await one<{ s: string }>("SELECT confirmacao_status s FROM payments WHERE id=$1", [PAY1])).s).toBe("informado");
  });
  it("case 1: values come from the payment row, not the caller; payments.status untouched", async () => {
    await as(ADMIN, "admin");
    const r = (await confirm("payment", PAY1)).rows[0].r;
    const rec = await one<{ amount_cents: number; paid_on: string; method: string; confirmed_by: string }>(
      "SELECT amount_cents, paid_on::text, method, confirmed_by FROM payment_receipts WHERE id=$1", [r]);
    expect(rec).toEqual({ amount_cents: 15000, paid_on: "2026-10-05", method: "cash", confirmed_by: ADMIN });
    expect((await one<{ s: string; c: string }>("SELECT status::text s, confirmacao_status c FROM payments WHERE id=$1", [PAY1]))).toEqual({ s: "paid", c: "confirmado" });
    // old signature with arbitrary values does not exist
    await expect(db.query("SELECT public.confirm_receipt('payment',$1,$2,'k','h',1,'2026-01-01','cash','gA')", [PAY1, PA])).rejects.toThrow();
  });
  it("case 2: payment of contact B on project A is rejected", async () => {
    await as(ADMIN, "admin");
    await expect(confirm("payment", PAYB)).rejects.toThrow("contato_divergente");
    await expect(confirm("payment", PAY1, [PB, null, null])).rejects.toThrow("projeto_divergente");
  });
  it("case 3: same payments.id via payment and booking_deposit aliases maps to ONE receipt", async () => {
    await as(ADMIN, "admin");
    const a = (await confirm("payment", PAY1)).rows[0].r;
    const b = (await confirm("booking_deposit", PAY1)).rows[0].r;
    expect(b).toBe(a);
    expect((await one<{ n: number }>("SELECT count(*)::int n FROM payment_mirror_outbox")).n).toBe(1);
    await expect(confirm("booking_deposit", PAY3)).rejects.toThrow("fonte_invalida"); // not a deposit
  });
  it("case 4: a confirmation that fails leaves the source unconfirmed (no key without mapping)", async () => {
    await as(null, null);
    await db.exec(`INSERT INTO payment_receipts(idempotency_key,payload_hash,location_id,project_id,ghl_contact_id,amount_cents,paid_on,method,confirmed_by)
      VALUES ('movimentacao:${MOV1}','x','9iqrKUVPDddINb9S4Iwd','${PA}','gA',1,'2026-01-01','cash','${ADMIN}')`);
    await as(ADMIN, "admin");
    await expect(confirm("movimentacao", MOV1)).rejects.toThrow("conflito_idempotencia");
    expect((await one<{ s: string }>("SELECT confirmacao_status s FROM movimentacoes WHERE id=$1", [MOV1])).s).toBe("informado");
  });
  it("case 5: same_event_source must exist and match the event", async () => {
    await as(ADMIN, "admin");
    await expect(confirm("payment", PAY1, [null, "movimentacao", NOPE])).rejects.toThrow("fonte_invalida");
    await expect(confirm("payment", PAY1, [null, "movimentacao", MOVX])).rejects.toThrow("evento_divergente");
    const r = (await confirm("payment", PAY1, [null, "movimentacao", MOV1])).rows[0].r;
    expect((await one<{ n: number }>("SELECT count(*)::int n FROM payment_receipt_sources WHERE receipt_id=$1", [r])).n).toBe(2);
    expect((await confirm("movimentacao", MOV1)).rows[0].r).toBe(r); // no second receipt
    expect((await one<{ n: number }>("SELECT count(*)::int n FROM payment_receipts")).n).toBe(1);
  });
});

describe("worker SQL", () => {
  async function seedTwoSameProject() {
    await as(ADMIN, "admin");
    await confirm("payment", PAY1); await confirm("payment", PAY3); await confirm("payment", PAY4);
    await as(null, null);
  }
  it("RPCs of service are not executable by authenticated", async () => {
    await seedTwoSameProject();
    await db.exec("SET ROLE authenticated");
    await expect(db.query("SELECT * FROM claim_payment_mirror(10,60)")).rejects.toThrow("permission denied");
    await db.exec("RESET ROLE");
  });
  it("case 6: claim returns at most one job per project per batch and blocks the next claim", async () => {
    await seedTwoSameProject();
    const rows = (await db.query<{ receipt_id: string }>("SELECT * FROM claim_payment_mirror(10,60)")).rows;
    expect(rows).toHaveLength(2); // project A once + project A2
    expect((await db.query("SELECT * FROM claim_payment_mirror(10,60)")).rows).toHaveLength(0);
  });
  it("rotates pending jobs so twenty older projects cannot starve the twenty-first", async () => {
    await as(ADMIN, "admin");
    const receipts: string[] = [];
    for (let i = 1; i <= 21; i++) {
      const uuid = (n: number) => `00000000-0000-0000-1000-${n.toString(16).padStart(12, "0")}`;
      const project = uuid(1000 + i), appointment = uuid(2000 + i), payment = uuid(3000 + i);
      await db.query("INSERT INTO tattoo_projects(id,ghl_contact_id,title,quoted_total_eur) VALUES ($1,'gA','Queue fixture',600)", [project]);
      await db.query("INSERT INTO appointments(id,project_id,contact_id,ghl_contact_id) VALUES ($1,$2,$3,'gA')", [appointment, project, CA]);
      await db.query("INSERT INTO payments(id,appointment_id,contact_id,amount_eur,type,method,status,paid_at) VALUES ($1,$2,$3,10,'final','cash','paid','2026-10-05T10:00:00Z')", [payment, appointment, CA]);
      const receipt = (await confirm("payment", payment)).rows[0].r;
      receipts.push(receipt);
      // Explicit past timestamps make priority deterministic without sleeping or mocking the DB clock.
      await db.query("UPDATE payment_mirror_outbox SET created_at='2000-01-01T00:00:00Z'::timestamptz + $2::int * interval '1 day', updated_at='2000-01-01T00:00:00Z'::timestamptz + $2::int * interval '1 day' WHERE receipt_id=$1", [receipt, i]);
    }
    await as(null, null);
    type Job = { id: string; receipt_id: string; lease_token: string };
    const first = (await db.query<Job>("SELECT * FROM claim_payment_mirror(20,60)")).rows;
    expect(first).toHaveLength(20);
    expect(first.some((r) => r.receipt_id === receipts[20])).toBe(false);
    for (const job of first) {
      expect((await one<{ ok: boolean }>("SELECT mirror_set_state($1,$2,'pending','aguarda_conferencia') ok", [job.id, job.lease_token])).ok).toBe(true);
    }
    const second = (await db.query<Job>("SELECT * FROM claim_payment_mirror(20,60)")).rows;
    expect(second).toHaveLength(20);
    expect(second.some((r) => r.receipt_id === receipts[20])).toBe(true);
    expect((await one<{ n: number }>("SELECT count(*)::int n FROM payment_receipts")).n).toBe(21);
    expect((await one<{ n: number }>("SELECT count(*)::int n FROM payment_mirror_outbox WHERE state='pending' AND in_flight IS NULL")).n).toBe(21);
  });
  it("case 7: expired in-flight record is recovered as pagamento_a_conciliar, never as pending", async () => {
    await seedTwoSameProject();
    const [job] = (await db.query<{ id: string; lease_token: string }>("SELECT * FROM claim_payment_mirror(1,60)")).rows;
    expect((await one<{ ok: boolean }>("SELECT mirror_mark_in_flight($1,$2,'record') ok", [job.id, job.lease_token])).ok).toBe(true);
    await db.exec(`UPDATE payment_mirror_outbox SET lease_until = now() - interval '1 second' WHERE id='${job.id}'`);
    const again = (await db.query<{ id: string; state: string; in_flight: string | null }>("SELECT * FROM claim_payment_mirror(10,60)")).rows;
    // Recovery persists regardless of which same-project job wins the fair next lease.
    const same = await one<{ state: string; in_flight: string | null }>("SELECT state,in_flight FROM payment_mirror_outbox WHERE id=$1", [job.id]);
    expect(same.state).toBe("pagamento_a_conciliar");
    expect(same.in_flight).toBeNull();
    expect(again.filter((r) => r.id === job.id).every((r) => r.state === "pagamento_a_conciliar" && r.in_flight === null)).toBe(true);
    // old worker is fenced
    expect((await one<{ ok: boolean }>("SELECT mirror_set_state($1,$2,'concluido',NULL,'tx') ok", [job.id, job.lease_token])).ok).toBe(false);
  });
  it("one invoice link per project in the database", async () => {
    await seedTwoSameProject();
    const [job] = (await db.query<{ id: string; lease_token: string }>("SELECT * FROM claim_payment_mirror(1,60)")).rows;
    expect((await one<{ ok: boolean }>("SELECT mirror_save_link($1,$2,'inv-1') ok", [job.id, job.lease_token])).ok).toBe(true);
    expect((await one<{ ok: boolean }>("SELECT mirror_save_link($1,$2,'inv-2') ok", [job.id, job.lease_token])).ok).toBe(false);
    expect((await one<{ n: number }>("SELECT count(*)::int n FROM project_invoice_links")).n).toBe(1);
    const ctx = await one<{ c: { project: { approved_total_eur: number }; link: { invoice_id: string } } }>("SELECT mirror_load_context($1,$2) c", [job.id, job.lease_token]);
    expect(ctx.c.link.invoice_id).toBe("inv-1");
    expect(Number(ctx.c.project.approved_total_eur)).toBe(600);
  });
});

describe("refunds", () => {
  it("case 8: cumulative refunds above the original are rejected", async () => {
    await as(ADMIN, "admin");
    const r = (await confirm("payment", PAY1)).rows[0].r;
    await db.query("SELECT request_receipt_refund($1,10000,'2026-10-10')", [r]);
    await expect(db.query("SELECT request_receipt_refund($1,5001,'2026-11-10')", [r])).rejects.toThrow("estorno_excede_original");
    await db.query("SELECT request_receipt_refund($1,5000,'2026-11-10')", [r]);
    await as(null, null);
    await expect(db.query(`INSERT INTO payment_receipt_refunds(receipt_id,amount_cents,refunded_on,created_by) VALUES ($1,1,'2026-12-01',$2)`, [r, ADMIN])).rejects.toThrow("estorno_excede_original");
    await as(ARTIST, "artist");
    await expect(db.query("SELECT request_receipt_refund($1,1,'2026-12-01')", [r])).rejects.toThrow("forbidden");
  });
});
