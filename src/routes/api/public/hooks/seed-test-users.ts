import { createFileRoute } from "@tanstack/react-router";

// One-shot seed for admin + tatuador test users. Protected by `x-seed-secret`
// header (SEED_SECRET env var). Remove this route after seeding.

const USERS = [
  {
    email: "admin@gftattoo.test",
    password: "Admin#2026",
    role: "admin" as const,
    artistName: null as string | null,
  },
  {
    email: "gabriel@gftattoo.test",
    password: "Artist#2026",
    role: "artist" as const,
    artistName: "Gabriel Fernandes",
  },
];

export const Route = createFileRoute("/api/public/hooks/seed-test-users")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.SEED_SECRET;
        if (!secret) return new Response("missing SEED_SECRET", { status: 500 });
        const given = request.headers.get("x-seed-secret") ?? "";
        if (given !== secret) return new Response("forbidden", { status: 403 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const results: Array<Record<string, unknown>> = [];
        for (const u of USERS) {
          // Resolve artist id from name (if any)
          let artistId: string | null = null;
          if (u.artistName) {
            const { data: artist } = await supabaseAdmin
              .from("artists" as never)
              .select("id")
              .eq("name", u.artistName)
              .maybeSingle();
            artistId = (artist as { id: string } | null)?.id ?? null;
            if (!artistId) {
              results.push({ email: u.email, error: `artist not found: ${u.artistName}` });
              continue;
            }
          }

          // Try to find an existing auth user by email
          let userId: string | null = null;
          const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 200,
          });
          if (listErr) {
            results.push({ email: u.email, error: `listUsers: ${listErr.message}` });
            continue;
          }
          const existing = list.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
          if (existing) {
            userId = existing.id;
            // Reset password to known test value
            await supabaseAdmin.auth.admin.updateUserById(userId, { password: u.password });
          } else {
            const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
              email: u.email,
              password: u.password,
              email_confirm: true,
            });
            if (createErr || !created.user) {
              results.push({ email: u.email, error: `createUser: ${createErr?.message}` });
              continue;
            }
            userId = created.user.id;
          }

          const { error: upsertErr } = await supabaseAdmin
            .from("app_users" as never)
            .upsert(
              { id: userId, role: u.role, artist_id: artistId } as never,
              { onConflict: "id" } as never,
            );
          if (upsertErr) {
            results.push({ email: u.email, error: `app_users upsert: ${upsertErr.message}` });
            continue;
          }

          results.push({
            email: u.email,
            password: u.password,
            role: u.role,
            userId,
            artistId,
            ok: true,
          });
        }

        return Response.json({ ok: true, results });
      },
    },
  },
});