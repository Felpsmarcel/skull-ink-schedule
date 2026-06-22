// GHL proxy — repassa chamadas para https://services.leadconnectorhq.com
// O token GHL_TOKEN fica como secret no Supabase e nunca chega ao frontend.

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
