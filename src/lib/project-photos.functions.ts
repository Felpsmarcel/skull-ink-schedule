import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProjectPhotosResult } from "@/lib/project-photos-adapter";

/** Storage has not been deployed. Verify scope before exposing even its capability state. */
export const getProjectPhotosAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ projectId: z.string().uuid() }).parse(value))
  .handler(async ({ data, context }): Promise<ProjectPhotosResult> => {
    const { supabase, userId } = context;
    const identity = await supabase
      .from("app_users")
      .select("role, artist_id")
      .eq("id", userId)
      .maybeSingle();
    if (identity.error || !identity.data || !["admin", "artist"].includes(identity.data.role))
      return { kind: "forbidden" };
    if (identity.data.role === "artist" && !identity.data.artist_id) return { kind: "forbidden" };
    let project = supabase.from("tattoo_projects").select("id").eq("id", data.projectId);
    if (identity.data.role === "artist")
      project = project.eq("artist_id", identity.data.artist_id!);
    const match = await project.maybeSingle();
    if (match.error || !match.data) return { kind: "forbidden" };
    return {
      kind: "disabled",
      message:
        "A galeria está preparada, mas o armazenamento de fotos ainda aguarda ativação. Nenhuma foto pode ser enviada ou removida nesta versão.",
    };
  });
