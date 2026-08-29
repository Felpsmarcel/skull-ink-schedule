import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  TRACEABILITY_ACTIVATED_AT,
  brusselsTime,
  brusselsToday,
  buildFilaItems,
  homeActions,
  homeRole,
  resolveArtistScope,
  prioritizePendencias,
  selectNextAppointment,
  stripUnauthorized,
  type FilaSource,
  type HomeDashboard,
  type HomeFilaItem,
  type NextCandidate,
  type Pendencia,
} from "@/lib/home-dashboard";
import { brusselsDayEndMs } from "@/lib/agenda-grid";

/**
 * Agregador único do painel da Home. Uma chamada por render, papel resolvido
 * no servidor e bloco de gestão isolado (falha parcial não derruba a operação).
 */
export const getHomeDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HomeDashboard> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("app_users" as never)
      .select("role, artist_id")
      .eq("id", userId)
      .maybeSingle();
    const prof = (profile ?? null) as { role: string | null; artist_id: string | null } | null;
    const role = homeRole(prof?.role);
    const scope = resolveArtistScope(role, prof?.artist_id ?? null);
    const artistId = scope.kind === "artist" ? scope.artistId : null;

    const now = new Date();
    const nowMs = now.getTime();
    const dayEndMs = brusselsDayEndMs(now);

    /* ------------------------- operação (sempre) ------------------------- */
    // Fail-closed: artista sem artist_id vinculado não consulta nada global.
    let candidates: NextCandidate[] = [];
    if (scope.kind !== "none") {
      try {
        let q = supabase
          .from("appointments")
          .select("id, ghl_appointment_id, start_at, end_at, status, contact_name, artist_id, artists(name)")
          .gte("end_at", new Date(nowMs).toISOString())
          .lte("start_at", new Date(dayEndMs).toISOString())
          .order("start_at", { ascending: true })
          .limit(20);
        if (artistId) q = q.eq("artist_id", artistId);
        const { data } = await q;
        candidates = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
          id: String(r.id),
          ghlAppointmentId: (r.ghl_appointment_id as string | null) ?? null,
          startAt: String(r.start_at),
          endAt: String(r.end_at),
          status: String(r.status),
          clientName: (r.contact_name as string | null) ?? null,
          artistId: r.artist_id ? String(r.artist_id) : "",
          artistName: ((r.artists as { name?: string } | null)?.name as string | undefined) ?? null,
        }));
      } catch (error) {
        console.warn("home: appointments unavailable", sanitize(error));
      }
    }

    const next = selectNextAppointment(candidates, { nowMs, dayEndMs, scope });

    let aguardando = 0;
    let emAtendimento = 0;
    let filaItens: HomeFilaItem[] = [];
    if (scope.kind !== "none") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any).rpc("list_checkins_hoje");
        const rows: FilaSource[] = (
          (data ?? []) as Array<Record<string, unknown>>
        ).map((r) => ({
          codigo: String(r.codigo_atendimento ?? ""),
          clienteNome: (r.cliente_nome as string | null) ?? null,
          status: String(r.status ?? ""),
          arrivedAt: (r.arrived_at as string | null) ?? null,
          scheduledAt: (r.scheduled_at as string | null) ?? null,
          artistId: (r.artist_id as string | null) ?? null,
          artistName: (r.tatuador as string | null) ?? null,
        }));
        const visible = scope.kind === "artist"
          ? rows.filter((r) => r.artistId === scope.artistId)
          : rows;
        for (const row of visible) {
          if (row.status === "aguardando") aguardando += 1;
          if (row.status === "em_atendimento") emAtendimento += 1;
        }
        filaItens = buildFilaItems(rows, scope, nowMs);
      } catch (error) {
        console.warn("home: fila unavailable", sanitize(error));
      }
    }

    const dashboard: HomeDashboard = {
      role,
      dateLabel: brusselsToday(now),
      updatedAtISO: now.toISOString(),
      next: next
        ? {
            ghlAppointmentId: next.ghlAppointmentId,
            timeLabel: brusselsTime(next.startAt),
            clientName: next.clientName?.trim() || "Cliente sem nome",
            artistName: next.artistName,
            status: next.status,
          }
        : null,
      fila: { aguardando, emAtendimento, itens: filaItens },
      actions: homeActions(role),
    };

    /* --------------------------- gestão (admin) --------------------------- */
    if (role === "admin") {
      dashboard.gestao = await buildGestao(supabase, nowMs);
    }

    return stripUnauthorized(dashboard);
  });

/* eslint-disable @typescript-eslint/no-explicit-any */
async function buildGestao(supabase: any, nowMs: number): Promise<NonNullable<HomeDashboard["gestao"]>> {
  const marco = TRACEABILITY_ACTIVATED_AT;
  const nowISO = new Date(nowMs).toISOString();
  const days30ISO = new Date(nowMs - 30 * 86_400_000).toISOString();
  let degraded = false;
  const fail = (what: string, error: unknown) => {
    degraded = true;
    console.warn(`home gestao: ${what} unavailable`, sanitize(error));
  };

  let recebidoHoje = 0;
  let vinculosHistorico = 0;
  let vinculosNovos = 0;
  let reconciliation = 0;
  let sessoesSemPagamento = 0;
  let passadosConfirmados = 0;

  const hojeKey = new Date(nowMs).toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" });

  await Promise.all([
    (async () => {
      try {
        const { data, error } = await supabase
          .from("movimentacoes")
          .select("valor_dinheiro, valor_cartao, valor_sumup, valor_transferencia")
          .is("deleted_at", null)
          .eq("data_pagamento", hojeKey);
        if (error) throw new Error(error.message);
        for (const r of (data ?? []) as Array<Record<string, number | null>>) {
          recebidoHoje +=
            Number(r.valor_dinheiro ?? 0) +
            Number(r.valor_cartao ?? 0) +
            Number(r.valor_sumup ?? 0) +
            Number(r.valor_transferencia ?? 0);
        }
        recebidoHoje = Math.round(recebidoHoje * 100) / 100;
      } catch (error) {
        fail("recebido hoje", error);
      }
    })(),
    (async () => {
      try {
        const { data, error } = await supabase.rpc("count_vinculos_incompletos");
        if (error) throw new Error(error.message);
        vinculosHistorico = Number((data as { total?: number } | null)?.total ?? 0);
      } catch (error) {
        fail("vínculos históricos", error);
      }
    })(),
    (async () => {
      try {
        const appt = await supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .is("project_id", null)
          .gte("created_at", marco);
        const mov = await supabase
          .from("movimentacoes")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .is("project_id", null)
          .is("appointment_id", null)
          .in("tipo_movimento", ["sinal", "sessao"])
          .gte("created_at", marco);
        if (appt.error) throw new Error(appt.error.message);
        if (mov.error) throw new Error(mov.error.message);
        vinculosNovos = Number(appt.count ?? 0) + Number(mov.count ?? 0);
      } catch (error) {
        fail("vínculos novos", error);
      }
    })(),
    (async () => {
      try {
        const { count, error } = await supabase
          .from("booking_operations")
          .select("id", { count: "exact", head: true })
          .eq("status", "reconciliation_required");
        if (error) throw new Error(error.message);
        reconciliation = Number(count ?? 0);
      } catch (error) {
        fail("reconciliação", error);
      }
    })(),
    (async () => {
      try {
        const { data, error } = await supabase
          .from("appointments")
          .select("id")
          .eq("status", "completed")
          .gte("end_at", days30ISO)
          .lt("end_at", nowISO)
          .limit(500);
        if (error) throw new Error(error.message);
        const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
        if (ids.length === 0) return;
        const pagos = new Set<string>();
        for (let i = 0; i < ids.length; i += 100) {
          const chunk = ids.slice(i, i + 100);
          const { data: movs, error: movErr } = await supabase
            .from("movimentacoes")
            .select("appointment_id")
            .is("deleted_at", null)
            .in("appointment_id", chunk);
          if (movErr) throw new Error(movErr.message);
          for (const m of (movs ?? []) as Array<{ appointment_id: string | null }>) {
            if (m.appointment_id) pagos.add(m.appointment_id);
          }
        }
        sessoesSemPagamento = ids.filter((id) => !pagos.has(id)).length;
      } catch (error) {
        fail("sessões sem pagamento", error);
      }
    })(),
    (async () => {
      try {
        const { count, error } = await supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .in("status", ["confirmed", "pending"])
          .gte("end_at", days30ISO)
          .lt("end_at", nowISO);
        if (error) throw new Error(error.message);
        passadosConfirmados = Number(count ?? 0);
      } catch (error) {
        fail("agendamentos passados", error);
      }
    })(),
  ]);

  const all: Pendencia[] = [
    {
      kind: "reconciliation",
      label: "Agendamentos a reconciliar",
      count: reconciliation,
      severity: "critica",
      to: "/reconciliar",
    },
    {
      kind: "vinculos",
      label: "Vínculos incompletos novos",
      count: vinculosNovos,
      severity: "critica",
      to: "/relatorios/movimentacoes",
    },
    {
      kind: "sessoes_sem_pagamento",
      label: "Sessões concluídas sem pagamento",
      count: sessoesSemPagamento,
      severity: "atencao",
      to: "/relatorios/agendamentos",
    },
    {
      kind: "passados_confirmados",
      label: "Agendamentos passados não encerrados",
      count: passadosConfirmados,
      severity: "atencao",
      to: "/relatorios/agendamentos",
    },
  ];

  return {
    recebidoHoje,
    pendencias: prioritizePendencias(all),
    vinculosHistorico,
    vinculosNovos,
    marcoRastreabilidade: marco,
    degraded,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function sanitize(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.slice(0, 180);
}
