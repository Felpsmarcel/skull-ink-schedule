// GHL proxy — repassa chamadas para https://services.leadconnectorhq.com
// O token GHL_TOKEN fica como secret no Supabase e nunca chega ao frontend.
//
// Autorização: exige um JWT Supabase no header Authorization. Se o usuário
// for "artist", validamos que qualquer calendarId presente em path/query/body
// pertence ao artist_id dele. Admin passa livre.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const GHL_BASE = "https://services.leadconnectorhq.com";
const DEFAULT_VERSION = "2021-04-15";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProxyRequest {
  path: string;
  method?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  version?: string;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractCalendarIds(payload: ProxyRequest): string[] {
  const ids = new Set<string>();
  // path: /calendars/{id}/free-slots, etc.
  const m = payload.path.match(/\/calendars\/([A-Za-z0-9_-]{10,})/);
  if (m) ids.add(m[1]);
  // query
  const q = payload.query ?? {};
  for (const key of ["calendarId", "calendar_id"]) {
    const v = q[key];
    if (typeof v === "string" && v) ids.add(v);
  }
  // body
  const b = (payload.body ?? null) as Record<string, unknown> | null;
  if (b && typeof b === "object") {
    for (const key of ["calendarId", "calendar_id"]) {
      const v = b[key];
      if (typeof v === "string" && v) ids.add(v);
    }
  }
  return Array.from(ids);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const token = Deno.env.get("GHL_TOKEN");
  if (!token) {
    return json(500, { error: "missing_secret", detail: "GHL_TOKEN não está configurado no backend." });
  }

  let payload: ProxyRequest;
  try {
    payload = await req.json();
  } catch (_e) {
    return json(400, { error: "invalid_json", detail: "Corpo da requisição precisa ser JSON." });
  }

  if (!payload?.path || typeof payload.path !== "string" || !payload.path.startsWith("/")) {
    return json(400, { error: "invalid_path", detail: "`path` é obrigatório e deve começar com /" });
  }

  // --- AuthZ: verifica JWT do Supabase e papel do usuário ----------------
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("authorization") ?? "";
  if (SUPABASE_URL && SERVICE_KEY && authHeader.startsWith("Bearer ")) {
    try {
      const jwt = authHeader.slice("Bearer ".length);
      const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
      if (userErr || !userRes?.user) {
        return json(401, { error: "unauthorized", detail: "JWT inválido." });
      }
      const uid = userRes.user.id;
      const { data: appUser } = await admin
        .from("app_users")
        .select("role, artist_id")
        .eq("id", uid)
        .maybeSingle();
      const role = (appUser?.role ?? null) as "admin" | "artist" | null;
      const artistId = (appUser?.artist_id ?? null) as string | null;

      if (role !== "admin") {
        const requested = extractCalendarIds(payload);
        if (requested.length > 0) {
          if (!artistId) {
            return json(403, { error: "forbidden", detail: "Usuário sem artist_id vinculado." });
          }
          const { data: artistRow } = await admin
            .from("artists")
            .select("ghl_calendar_id")
            .eq("id", artistId)
            .maybeSingle();
          const allowed = artistRow?.ghl_calendar_id ?? null;
          if (!allowed || !requested.every((id) => id === allowed)) {
            return json(403, {
              error: "forbidden",
              detail: "Acesso a este calendário não permitido para este usuário.",
            });
          }
        }
      }
    } catch (e) {
      console.error("ghl-proxy authz error", e);
      return json(500, { error: "authz_failed", detail: e instanceof Error ? e.message : String(e) });
    }
  }
  // ------------------------------------------------------------------------

  const method = (payload.method ?? "GET").toUpperCase();
  const version = payload.version ?? DEFAULT_VERSION;

  const url = new URL(GHL_BASE + payload.path);
  if (payload.query) {
    for (const [k, v] of Object.entries(payload.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Version: version,
    Accept: "application/json",
  };

  let body: string | undefined;
  if (payload.body !== undefined && method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(payload.body);
  }

  try {
    const upstream = await fetch(url.toString(), { method, headers, body });
    const text = await upstream.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_e) {
      // não-JSON — devolve como string
    }
    console.log(JSON.stringify({
      tag: "ghl-proxy",
      method,
      upstreamUrl: url.toString(),
      status: upstream.status,
      ok: upstream.ok,
      sample: text.slice(0, 400),
    }));
    return new Response(
      JSON.stringify({ status: upstream.status, ok: upstream.ok, data, url: url.toString() }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("ghl-proxy upstream_fetch_failed", err);
    return json(502, {
      error: "upstream_fetch_failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});
