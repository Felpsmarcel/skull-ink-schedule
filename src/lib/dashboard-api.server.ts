import { z } from "zod";
import { supabaseForBearer } from "./mcp/supabase";
import { dashboardPeriod, localDateSchema } from "./dashboard-period";
import { DashboardError, resolveDashboardScope } from "./dashboard-scope";
import { readDashboard } from "./dashboard-read.server";

const input = z.object({ from: localDateSchema, to: localDateSchema }).strict();
export async function mobileDashboardResponse(request: Request): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ") || !auth.slice(7).trim())
      throw new DashboardError(401, "Sessão necessária");
    const token = auth.slice(7);
    const client = supabaseForBearer(token);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) throw new DashboardError(401, "Sessão inválida");
    const scope = await resolveDashboardScope(client, data.user.id);
    const url = new URL(request.url);
    if (new Set(url.searchParams.keys()).size !== Array.from(url.searchParams.keys()).length)
      throw new DashboardError(400, "Parâmetros duplicados");
    const parsed = input.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) throw new DashboardError(400, "Somente from e to válidos são permitidos");
    try {
      dashboardPeriod(parsed.data.from, parsed.data.to);
    } catch {
      throw new DashboardError(400, "Período inválido (máximo 93 dias)");
    }
    return Response.json(
      await readDashboard(client, scope, parsed.data.from, parsed.data.to, request.signal),
      { headers },
    );
  } catch (e) {
    const status = e instanceof DashboardError ? e.status : 503;
    return Response.json(
      { error: e instanceof DashboardError ? e.message : "Leitura indisponível" },
      { status, headers },
    );
  }
}
