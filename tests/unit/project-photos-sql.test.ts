// SQL review exercised only against ephemeral, isolated PGlite. No live database.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const db = new PGlite();
const ADMIN = "00000000-0000-0000-0000-000000000001";
const ARTIST_A = "00000000-0000-0000-0000-000000000002";
const ARTIST_B = "00000000-0000-0000-0000-000000000003";
const SELLER = "00000000-0000-0000-0000-000000000004";
const UNASSIGNED = "00000000-0000-0000-0000-000000000005";
const P1 = "00000000-0000-0000-0000-000000000101";
const P2 = "00000000-0000-0000-0000-000000000102";
const P3 = "00000000-0000-0000-0000-000000000103";
const F1 = "00000000-0000-0000-0000-000000000201";
const F2 = "00000000-0000-0000-0000-000000000202";
const F3 = "00000000-0000-0000-0000-000000000203";

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE TABLE public.app_users(id uuid PRIMARY KEY, role text, artist_id uuid);
    CREATE TABLE public.tattoo_projects(id uuid PRIMARY KEY, artist_id uuid);
    CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY, bucket_id text, name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA public, auth, storage TO authenticated;
    GRANT SELECT ON storage.objects TO authenticated;
    INSERT INTO public.app_users VALUES ('${ADMIN}','admin',null),('${ARTIST_A}','artist','${ARTIST_A}'),('${ARTIST_B}','artist','${ARTIST_B}'),('${SELLER}','seller',null),('${UNASSIGNED}','artist',null);
    INSERT INTO public.tattoo_projects VALUES ('${P1}','${ARTIST_A}'),('${P2}','${ARTIST_B}'),('${P3}',null);
  `);
  await db.exec(readFileSync("docs/sql/project-photos.review.sql", "utf8"));
  for (const [project, photo] of [
    [P1, F1],
    [P2, F2],
    [P3, F3],
  ]) {
    await db.query(
      "INSERT INTO public.project_photos(id,project_id,created_by,kind,caption,storage_path,mime_type,byte_size,request_id) VALUES ($1,$2,$3,'before','synthetic',$4,'image/jpeg',100,$1)",
      [photo, project, ADMIN, `${project}/${photo}`],
    );
    await db.query("INSERT INTO storage.objects VALUES ($1,'project-photos-private',$2)", [
      photo,
      `${project}/${photo}`,
    ]);
  }
  // An object with no validated metadata and one from another bucket never become visible.
  await db.exec(
    `INSERT INTO storage.objects VALUES ('00000000-0000-0000-0000-000000000204','project-photos-private','${P1}/unregistered'),('00000000-0000-0000-0000-000000000205','other-bucket','${P1}/${F1}');`,
  );
}, 30_000);
afterAll(async () => {
  await db.close();
});

async function as(actor: string) {
  await db.exec(`RESET ROLE; SET test.uid='${actor}'; SET ROLE authenticated;`);
}
async function visible(table: "public.project_photos" | "storage.objects") {
  return (await db.query<{ id: string }>(`SELECT id FROM ${table} ORDER BY id`)).rows.map(
    (row) => row.id,
  );
}

describe("project photos review RLS", () => {
  it("admin sees all validated project photos and only their private objects", async () => {
    await as(ADMIN);
    expect(await visible("public.project_photos")).toEqual([F1, F2, F3]);
    expect(await visible("storage.objects")).toEqual([F1, F2, F3]);
  });
  it("each artist sees only their immutable project IDs, not another artist or unassigned projects", async () => {
    await as(ARTIST_A);
    expect(await visible("public.project_photos")).toEqual([F1]);
    expect(await visible("storage.objects")).toEqual([F1]);
    await as(ARTIST_B);
    expect(await visible("public.project_photos")).toEqual([F2]);
    expect(await visible("storage.objects")).toEqual([F2]);
  });
  it.each([SELLER, UNASSIGNED, "00000000-0000-0000-0000-000000000099", ""])(
    "denies unscoped identity %s",
    async (actor) => {
      await as(actor);
      expect(await visible("public.project_photos")).toEqual([]);
      expect(await visible("storage.objects")).toEqual([]);
    },
  );
  it("does not permit direct authenticated metadata mutations, including by admin", async () => {
    await as(ADMIN);
    await expect(
      db.exec(`UPDATE public.project_photos SET caption='forged' WHERE id='${F1}'`),
    ).rejects.toThrow(/permission denied/);
    await expect(db.exec(`DELETE FROM public.project_photos WHERE id='${F1}'`)).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.exec(`INSERT INTO public.project_photos DEFAULT VALUES`)).rejects.toThrow(
      /permission denied/,
    );
  });
  it("denies anonymous metadata and keeps the bucket private", async () => {
    await db.exec("RESET ROLE; SET ROLE anon;");
    await expect(db.exec("SELECT * FROM public.project_photos")).rejects.toThrow(
      /permission denied/,
    );
    await db.exec("RESET ROLE;");
    expect(
      (
        await db.query<{ public: boolean }>(
          "SELECT public FROM storage.buckets WHERE id='project-photos-private'",
        )
      ).rows[0].public,
    ).toBe(false);
  });
});
