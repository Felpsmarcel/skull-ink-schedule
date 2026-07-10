import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OnboardingStatus = {
  role: "admin" | "artist" | "seller" | null;
  artistId: string | null;
  onboardedAt: string | null;
  needsOnboarding: boolean;
};

async function loadArtistContext(supabase: any, userId: string) {
  const { data: appUser, error: e1 } = await supabase
    .from("app_users")
    .select("role, artist_id")
    .eq("id", userId)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  return appUser as { role: OnboardingStatus["role"]; artist_id: string | null } | null;
}

export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingStatus> => {
    const { supabase, userId } = context;
    const appUser = await loadArtistContext(supabase, userId);
    if (!appUser) {
      return { role: null, artistId: null, onboardedAt: null, needsOnboarding: false };
    }
    if (appUser.role !== "artist" || !appUser.artist_id) {
      return { role: appUser.role, artistId: appUser.artist_id, onboardedAt: null, needsOnboarding: false };
    }
    const { data: artist, error } = await supabase
      .from("artists")
      .select("onboarded_at")
      .eq("id", appUser.artist_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const onboardedAt = (artist as { onboarded_at: string | null } | null)?.onboarded_at ?? null;
    return {
      role: appUser.role,
      artistId: appUser.artist_id,
      onboardedAt,
      needsOnboarding: onboardedAt == null,
    };
  });

export const getMyArtistProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const appUser = await loadArtistContext(supabase, userId);
    if (!appUser?.artist_id) throw new Error("Nenhum tatuador vinculado.");
    const { data, error } = await supabase
      .from("artists")
      .select("id, name, phone, bio, avatar_url, specialties, onboarded_at")
      .eq("id", appUser.artist_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as {
      id: string;
      name: string;
      phone: string | null;
      bio: string | null;
      avatar_url: string | null;
      specialties: string[] | null;
      onboarded_at: string | null;
    };
  });

const ProfileInput = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(6).max(30),
  bio: z.string().max(500).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  specialties: z.array(z.string().min(1).max(40)).max(12).optional(),
});

export const updateArtistProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const appUser = await loadArtistContext(supabase, userId);
    if (!appUser?.artist_id) throw new Error("Nenhum tatuador vinculado.");
    const { error } = await supabase
      .from("artists")
      .update({
        name: data.name,
        phone: data.phone,
        bio: data.bio ?? null,
        avatar_url: data.avatar_url ?? null,
        specialties: data.specialties ?? [],
      })
      .eq("id", appUser.artist_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const AvailabilityInput = z.object({
  slots: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        start_time: z.string().regex(/^\d{2}:\d{2}$/),
        end_time: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .max(30),
});

export const getWeeklyAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const appUser = await loadArtistContext(supabase, userId);
    if (!appUser?.artist_id) return [] as Array<{ weekday: number; start_time: string; end_time: string }>;
    const { data, error } = await supabase
      .from("artist_weekly_availability")
      .select("weekday, start_time, end_time")
      .eq("artist_id", appUser.artist_id)
      .order("weekday", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ weekday: number; start_time: string; end_time: string }>;
  });

export const setWeeklyAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AvailabilityInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const appUser = await loadArtistContext(supabase, userId);
    if (!appUser?.artist_id) throw new Error("Nenhum tatuador vinculado.");
    const artistId = appUser.artist_id;
    const { error: delErr } = await supabase
      .from("artist_weekly_availability")
      .delete()
      .eq("artist_id", artistId);
    if (delErr) throw new Error(delErr.message);
    if (data.slots.length > 0) {
      const rows = data.slots.map((s) => ({
        artist_id: artistId,
        weekday: s.weekday,
        start_time: `${s.start_time}:00`,
        end_time: `${s.end_time}:00`,
      }));
      const { error: insErr } = await supabase.from("artist_weekly_availability").insert(rows as never);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true as const };
  });

export const listActiveServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("services")
      .select("id, name, category, duration_min")
      .eq("active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; name: string; category: string; duration_min: number }>;
  });

export const getMyArtistServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const appUser = await loadArtistContext(supabase, userId);
    if (!appUser?.artist_id) return [] as string[];
    const { data, error } = await supabase
      .from("artist_services")
      .select("service_id")
      .eq("artist_id", appUser.artist_id);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<{ service_id: string }>).map((r) => r.service_id);
  });

const ServicesInput = z.object({ service_ids: z.array(z.string().uuid()).max(200) });

export const setArtistServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ServicesInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const appUser = await loadArtistContext(supabase, userId);
    if (!appUser?.artist_id) throw new Error("Nenhum tatuador vinculado.");
    const artistId = appUser.artist_id;
    const { error: delErr } = await supabase
      .from("artist_services")
      .delete()
      .eq("artist_id", artistId);
    if (delErr) throw new Error(delErr.message);
    if (data.service_ids.length > 0) {
      const rows = data.service_ids.map((sid) => ({ artist_id: artistId, service_id: sid }));
      const { error: insErr } = await supabase.from("artist_services").insert(rows as never);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true as const };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const appUser = await loadArtistContext(supabase, userId);
    if (!appUser?.artist_id) throw new Error("Nenhum tatuador vinculado.");
    const { error } = await supabase
      .from("artists")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", appUser.artist_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const UploadAvatarInput = z.object({
  file_base64: z.string().min(10),
  content_type: z.string().min(3).max(80),
  extension: z.string().min(1).max(8),
});

export const uploadArtistAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UploadAvatarInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const appUser = await loadArtistContext(supabase, userId);
    if (!appUser?.artist_id) throw new Error("Nenhum tatuador vinculado.");
    const artistId = appUser.artist_id;
    const bytes = Uint8Array.from(atob(data.file_base64), (c) => c.charCodeAt(0));
    const path = `${artistId}/avatar-${Date.now()}.${data.extension.replace(/[^a-z0-9]/gi, "")}`;
    const { error: upErr } = await supabase.storage
      .from("artist-avatars")
      .upload(path, bytes, { contentType: data.content_type, upsert: true });
    if (upErr) throw new Error(upErr.message);
    const { data: signed, error: sErr } = await supabase.storage
      .from("artist-avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (sErr) throw new Error(sErr.message);
    return { path, url: signed?.signedUrl ?? null };
  });