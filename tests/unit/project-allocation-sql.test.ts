// Banco PGlite efêmero e descartável — nunca toca o banco real.
// Aplica docs/sql/project-session-allocation.review.sql sobre stubs mínimos do esquema atual.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const db = new PGlite();
const ADMIN = "00000000-0000-0000-0000-00000000a001";
const ARTIST = "00000000-0000-0000-0000-00000000a002";
const P1 = "00000000-0000-0000-0000-0000000000p1".replace("p", "c");
const P2 = "00000000-0000-0000-0000-0000000000d2";
const S1 = "00000000-0000-0000-0000-000000000051";
const S2 = "00000000-0000-0000-0000-000000000052";
const S3 = "00000000-0000-0000-0000-000000000053";
const SX = "00000000-0000-0000-0000-000000000059"; // sessão de outro projeto
const SC = "00000000-0000-0000-0000-00000000005c"; // cancelada
const key = (n: string) => `idem-${n}-0123456789abcdef`;

async function as(uid: string | null, role: string | null) {
  await db.exec(`RESET ROLE; SET test.uid='${uid ?? ""}'; SET test.role='${role ?? ""}';`);
}
async function save(
  version: number,
  k: string,
  lines: { appointment_id: string; amount_cents: number }[],
  project = P1,
) {
  const r = await db.query<{ r: { version: number; replayed: boolean } }>(
    "SELECT public.save_project_allocation_draft($1,$2,$3,$4::jsonb) AS r",
    [project, version, k, JSON.stringify(lines)],
  );
  return r.rows[0].r;
}
async function link(
  opp: string,
  contact: string,
  status: string,
  cents: number | null,
  decision: string | null,
  k: string,
  project = P1,
) {
  const r = await db.query<{ r: { kind: string; replayed: boolean } }>(
    "SELECT public.link_project_opportunity($1,$2,$3,$4,$5,$6,$7) AS r",
    [project, opp, contact, status, cents, decision, k],
  );
  return r.rows[0].r;
}
const lines = async () =>
  (
    await db.query<{ appointment_id: string; amount_cents: string }>(
      "SELECT appointment_id, amount_cents::text FROM public.project_allocation_lines WHERE project_id=$1 ORDER BY appointment_id",
      [P1],
    )
  ).rows.map((r) => [r.appointment_id, Number(r.amount_cents)]);

beforeAll(async () => {
  await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth;
  CREATE TYPE public.user_role AS ENUM ('admin','artist','seller');
  CREATE TYPE public.appt_status AS ENUM ('pending','confirmed','completed','cancelled','no_show');
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
  CREATE FUNCTION public.current_user_role() RETURNS public.user_role LANGUAGE sql AS $$ SELECT nullif(current_setting('test.role',true),'')::public.user_role $$;
  CREATE TABLE public.tattoo_projects(id uuid PRIMARY KEY, ghl_contact_id text, ghl_opportunity_id text,
    title text NOT NULL, quoted_total_eur numeric NOT NULL DEFAULT 0);
  CREATE TABLE public.appointments(id uuid PRIMARY KEY, project_id uuid REFERENCES public.tattoo_projects(id),
    status public.appt_status NOT NULL DEFAULT 'confirmed');
  `);
  await db.exec(readFileSync("docs/sql/project-session-allocation.review.sql", "utf8"));
}, 30_000);
afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec(`RESET ROLE;
    TRUNCATE public.project_opportunity_links, public.project_allocation_audit, public.project_allocation_lines,
      public.project_allocation_drafts, public.appointments, public.tattoo_projects CASCADE;
    INSERT INTO public.tattoo_projects VALUES ('${P1}','gA',NULL,'Cobertura',2700),('${P2}','gB','oppTaken','Outro',900);
    INSERT INTO public.appointments VALUES ('${S1}','${P1}','confirmed'),('${S2}','${P1}','confirmed'),('${S3}','${P1}','confirmed'),
      ('${SC}','${P1}','cancelled'),('${SX}','${P2}','confirmed');`);
  await as(ADMIN, "admin");
});

describe("rascunho de distribuição (PGlite isolado)", () => {
  it("salva e recarrega 3 sessões de 900,00 € em centavos, com autor e versão", async () => {
    const r = await save(
      0,
      key("a"),
      [S1, S2, S3].map((id) => ({ appointment_id: id, amount_cents: 90000 })),
    );
    expect(r).toEqual({ version: 1, replayed: false });
    expect(await lines()).toEqual([
      [S1, 90000],
      [S2, 90000],
      [S3, 90000],
    ]);
    const d = (
      await db.query<{ updated_by: string; contract_cents_snapshot: string }>(
        "SELECT updated_by, contract_cents_snapshot::text FROM public.project_allocation_drafts",
      )
    ).rows[0];
    expect(d).toEqual({ updated_by: ADMIN, contract_cents_snapshot: "270000" });
    const a = (
      await db.query<{ actor: string; version: number }>(
        "SELECT actor, version FROM public.project_allocation_audit",
      )
    ).rows;
    expect(a).toEqual([{ actor: ADMIN, version: 1 }]);
  });

  it("dupla submissão com a mesma chave não cria nova versão", async () => {
    const l = [{ appointment_id: S1, amount_cents: 100 }];
    await save(0, key("dup"), l);
    expect(await save(0, key("dup"), l)).toEqual({ version: 1, replayed: true });
    expect(
      Number(
        (
          await db.query<{ c: number }>(
            "SELECT count(*)::int c FROM public.project_allocation_audit",
          )
        ).rows[0].c,
      ),
    ).toBe(1);
  });

  it("duas abas: a segunda com versão antiga recebe conflito e nada muda", async () => {
    await save(0, key("t1"), [{ appointment_id: S1, amount_cents: 1000 }]);
    await expect(save(0, key("t2"), [{ appointment_id: S1, amount_cents: 5 }])).rejects.toThrow(
      /version_conflict/,
    );
    expect(await lines()).toEqual([[S1, 1000]]);
  });

  it("rollback: uma linha inválida no meio desfaz tudo", async () => {
    await save(0, key("ok"), [{ appointment_id: S1, amount_cents: 1000 }]);
    await expect(
      save(1, key("bad"), [
        { appointment_id: S1, amount_cents: 2000 },
        { appointment_id: SX, amount_cents: 1 },
      ]),
    ).rejects.toThrow(/foreign_session/);
    expect(await lines()).toEqual([[S1, 1000]]);
    const v = (
      await db.query<{ version: number }>("SELECT version FROM public.project_allocation_drafts")
    ).rows[0];
    expect(v.version).toBe(1);
  });

  it("rejeita excesso sobre o contrato, centavos fracionários, negativos e sessão cancelada", async () => {
    await expect(
      save(
        0,
        key("ex"),
        [S1, S2, S3].map((id) => ({ appointment_id: id, amount_cents: 90001 })),
      ),
    ).rejects.toThrow(/exceeds_contract/);
    await expect(save(0, key("fr"), [{ appointment_id: S1, amount_cents: 10.5 }])).rejects.toThrow(
      /invalid_line/,
    );
    await expect(save(0, key("ng"), [{ appointment_id: S1, amount_cents: -1 }])).rejects.toThrow(
      /invalid_line/,
    );
    await expect(save(0, key("cc"), [{ appointment_id: SC, amount_cents: 1 }])).rejects.toThrow(
      /cancelled_session/,
    );
    await expect(
      save(0, key("du"), [
        { appointment_id: S1, amount_cents: 1 },
        { appointment_id: S1, amount_cents: 2 },
      ]),
    ).rejects.toThrow(/invalid_line/);
  });

  it("linha congelada não muda nem some", async () => {
    await save(0, key("f0"), [{ appointment_id: S1, amount_cents: 90000 }]);
    await db.exec(
      `UPDATE public.project_allocation_lines SET frozen_at=now() WHERE appointment_id='${S1}'`,
    );
    await expect(save(1, key("f1"), [{ appointment_id: S1, amount_cents: 1 }])).rejects.toThrow(
      /frozen_line/,
    );
    await expect(save(1, key("f2"), [{ appointment_id: S2, amount_cents: 1 }])).rejects.toThrow(
      /frozen_line/,
    );
    await save(1, key("f3"), [
      { appointment_id: S1, amount_cents: 90000 },
      { appointment_id: S2, amount_cents: 5 },
    ]);
    expect(await lines()).toEqual([
      [S1, 90000],
      [S2, 5],
    ]);
  });

  it("artista, papel desconhecido e sem sessão são negados", async () => {
    for (const [u, r] of [
      [ARTIST, "artist"],
      [ADMIN, null],
      [null, "admin"],
      [ADMIN, "seller"],
    ] as const) {
      await as(u, r);
      await expect(save(0, key(`x${r}${u ? 1 : 0}`), [])).rejects.toThrow(/forbidden/);
    }
  });

  it("escrita direta na tabela é bloqueada para authenticated", async () => {
    await db.exec("SET ROLE authenticated");
    await expect(
      db.query(
        `INSERT INTO public.project_allocation_lines VALUES ('${P1}','${S1}',1,NULL,'${ADMIN}',now())`,
      ),
    ).rejects.toThrow();
  });
});

describe("vínculo de oportunidade (PGlite isolado)", () => {
  it("contrato 2700 x oportunidade 900 exige decisão explícita e nunca altera o contrato", async () => {
    await expect(link("o1", "gA", "open", 90000, null, key("o1"))).rejects.toThrow(
      /decision_required/,
    );
    expect(await link("o1", "gA", "open", 90000, "keep_contract", key("o1"))).toEqual({
      id: expect.any(String),
      replayed: false,
      kind: "active",
    });
    const q = (
      await db.query<{ q: string }>(
        `SELECT quoted_total_eur::text q FROM public.tattoo_projects WHERE id='${P1}'`,
      )
    ).rows[0];
    expect(q.q).toBe("2700");
  });

  it("várias oportunidades relacionadas no mesmo projeto, sem soma imposta", async () => {
    for (const o of ["o1", "o2", "o3"]) await link(o, "gA", "open", 90000, "keep_contract", key(o));
    const c = (
      await db.query<{ c: number }>("SELECT count(*)::int c FROM public.project_opportunity_links")
    ).rows[0];
    expect(c.c).toBe(3);
  });

  it("lost/abandoned entra apenas como histórico", async () => {
    expect((await link("oL", "gA", "lost", 0, null, key("oL"))).kind).toBe("historical");
    expect((await link("oA", "gA", "abandoned", null, null, key("oA"))).kind).toBe("historical");
  });

  it("outro contato e oportunidade de outro projeto são recusados; repetição é idempotente", async () => {
    await expect(link("o9", "gB", "open", 270000, null, key("o9"))).rejects.toThrow(
      /contact_mismatch/,
    );
    await expect(link("oppTaken", "gA", "open", 270000, null, key("ot"))).rejects.toThrow(
      /linked_elsewhere/,
    );
    await link("oE", "gA", "won", 270000, null, key("oE"));
    expect((await link("oE", "gA", "won", 270000, null, key("oE2"))).replayed).toBe(true);
    await expect(link("oE", "gB", "won", 90000, null, key("oE3"), P2)).rejects.toThrow(
      /contact_mismatch|linked_elsewhere/,
    );
  });

  it("artista não vincula", async () => {
    await as(ARTIST, "artist");
    await expect(link("o1", "gA", "open", 270000, null, key("ar"))).rejects.toThrow(/forbidden/);
  });
});
