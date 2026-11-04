// Private worker entry. Fail-closed: gates closed → 200 {enabled:false} with zero DB/HTTP;
// missing secret → 503; wrong bearer → 401. No cron is configured by this code.
import { gatesOpen, type ActivationGates } from "./payment-mirror-core";
import {
  runPaymentMirror,
  type MirrorStore,
  type MirrorTransport,
  type RunResult,
} from "./payment-mirror.server";

export interface RunDeps {
  gates: ActivationGates;
  secret: string | undefined;
  liveMode: boolean;
  makeStore: () => Promise<MirrorStore>;
  makeTransport: () => Promise<MirrorTransport>;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function handleMirrorRun(request: Request, deps: RunDeps): Promise<Response> {
  if (request.method !== "POST") return new Response("method_not_allowed", { status: 405 });
  if (!deps.secret || deps.secret.length < 32)
    return Response.json({ error: "not_configured" }, { status: 503 });
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !safeEqual(token, deps.secret))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!gatesOpen(deps.gates)) return Response.json({ enabled: false } satisfies Partial<RunResult>);
  const [store, transport] = await Promise.all([deps.makeStore(), deps.makeTransport()]);
  const res = await runPaymentMirror({
    gates: deps.gates,
    store,
    transport,
    liveMode: deps.liveMode,
  });
  return Response.json(res, { headers: { "Cache-Control": "no-store" } });
}
