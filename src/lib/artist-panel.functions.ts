import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readMyDayPages } from "@/lib/my-day-read";
import {
  commercialPresentation,
  DEFAULT_PANEL_ARTIST_ID,
  panelBounds,
  projectContinuity,
  requirePanelAdmin,
  type PanelAppointment,
} from "@/lib/artist-panel-core";

export const getArtistPanel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        artistId: z.string().uuid().optional(),
        horizon: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(60),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const identity = await supabase
      .from("app_users")
      .select("role, artist_id")
      .eq("id", userId)
      .maybeSingle();
    requirePanelAdmin(identity.error ? null : identity.data);
    const artistId = data.artistId ?? DEFAULT_PANEL_ARTIST_ID;
    const artists = await readMyDayPages(
      async (from, to) =>
        await supabase
          .from("artists")
          .select("id, name")
          .eq("active", true)
          .order("id")
          .range(from, to),
    );
    const artist = artists.find((a) => a.id === artistId);
    if (!artist) throw new Response("Forbidden", { status: 403 });
    const now = new Date();
    const bounds = panelBounds(now, data.horizon);
    const [agendaResult, projectsResult] = await Promise.allSettled([
      readMyDayPages(
        async (from, to) =>
          await supabase
            .from("appointments")
            .select("id, project_id, contact_name, start_at, end_at, status, ghl_appointment_id")
            .eq("artist_id", artistId)
            .order("start_at")
            .order("id")
            .range(from, to),
      ),
      readMyDayPages(
        async (from, to) =>
          await supabase
            .from("tattoo_projects")
            .select("id, title, status")
            .eq("artist_id", artistId)
            .in("status", ["lead", "quoted", "scheduled", "in_progress"])
            .order("id")
            .range(from, to),
      ),
    ]);
    const appointments: PanelAppointment[] | null =
      agendaResult.status === "fulfilled"
        ? agendaResult.value.map((a) => ({
            id: a.id,
            projectId: a.project_id,
            name: a.contact_name ?? "Cliente sem nome",
            startAt: a.start_at,
            endAt: a.end_at,
            status: a.status,
            ghlId: a.ghl_appointment_id,
          }))
        : null;
    const projects =
      projectsResult.status === "fulfilled"
        ? projectsResult.value.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            continuity: projectContinuity(p.id, appointments, now.getTime()),
            dates: appointments?.filter((a) => a.projectId === p.id) ?? null,
          }))
        : null;
    return {
      artist,
      artists,
      bounds,
      horizon: data.horizon,
      updatedAt: now.toISOString(),
      today:
        appointments?.filter((a) => a.startAt >= bounds.start && a.startAt < bounds.tomorrow) ??
        null,
      upcoming:
        appointments?.filter(
          (a) =>
            a.startAt >= bounds.tomorrow &&
            a.startAt < bounds.end &&
            ["pending", "confirmed"].includes(a.status),
        ) ?? null,
      projects,
      // No financial, contact, commercial opportunity or inferred classification fields.
    };
  });

export const getProjectCommercialPresentation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const identity = await supabase.from("app_users").select("role").eq("id", userId).maybeSingle();
    requirePanelAdmin(identity.error ? null : identity.data);
    const project = await supabase
      .from("tattoo_projects")
      .select("quoted_total_eur, deposit_eur")
      .eq("id", data.projectId)
      .maybeSingle();
    if (project.error || !project.data) throw new Error("Projeto indisponível");
    let movements: { total: number | string | null; tipo: string }[] | null = null;
    try {
      const rows = await readMyDayPages(
        async (from, to) =>
          await supabase
            .from("movimentacoes")
            .select("id, total, tipo_movimento")
            .eq("project_id", data.projectId)
            .is("deleted_at", null)
            .order("id")
            .range(from, to),
      );
      movements = rows.map((r) => ({ total: r.total, tipo: r.tipo_movimento }));
    } catch {
      /* unavailable is not zero */
    }
    return commercialPresentation(
      project.data.quoted_total_eur,
      project.data.deposit_eur,
      movements,
    );
  });
