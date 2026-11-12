import { fromZonedTime } from "date-fns-tz";
import { financePeriodBounds } from "@/lib/finance-list-filters";
import type {
  FinanceArea,
  FinanceProject,
  FinanceReceipt,
  FinanceSession,
  FinanceSource,
  FinanceWorkspaceData,
  FinanceWorkspaceModel,
  WorkspaceFilters,
  WorkspaceMetric,
} from "@/lib/finance-workspace-types";

const STUDIO_TZ = "Europe/Brussels";

/** Convert canonical monetary units to cents, without inventing missing values or rounding fractions. */
export function moneyCents(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string") {
    if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
    const [whole, fraction = ""] = value.trim().split(".");
    const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
    return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
  }
  const numeric = value;
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  const scaled = numeric * 100;
  const rounded = Math.round(scaled);
  if (
    !Number.isSafeInteger(rounded) ||
    Math.abs(scaled - rounded) > Number.EPSILON * Math.max(1, Math.abs(scaled)) * 2
  )
    return null;
  return rounded;
}

/** An incomplete or contradictory ID universe must never become a complete financial total. */
export function validateFinanceSource<T extends { id: string }>(rows: T[]): T[] {
  if (!Array.isArray(rows)) throw new Error("Fonte financeira inválida.");
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row.id !== "string" || !row.id.trim() || row.id !== row.id.trim()) {
      throw new Error("Registro financeiro sem identificador válido.");
    }
    if (seen.has(row.id)) throw new Error("Identificador financeiro duplicado.");
    seen.add(row.id);
  }
  return rows;
}

function validCivilDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function sourceTimestamp(value: unknown): number | null {
  if (validCivilDate(value)) return fromZonedTime(`${value}T00:00:00`, STUDIO_TZ).getTime();
  if (typeof value !== "string") return null;
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (
    !match ||
    !validCivilDate(match[1]) ||
    Number(match[2]) > 23 ||
    Number(match[3]) > 59 ||
    Number(match[4] ?? 0) > 59
  )
    return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

function periodBounds(filters: WorkspaceFilters, now: Date) {
  if (filters.period !== "custom") {
    if (!["today", "week", "month", "all"].includes(filters.period))
      throw new Error("Período inválido.");
    return financePeriodBounds(filters.period, now);
  }
  if (!validCivilDate(filters.from) || !validCivilDate(filters.to) || filters.from > filters.to)
    throw new Error("Período inválido.");
  const nextDay = new Date(`${filters.to}T12:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const bounds = {
    from: fromZonedTime(`${filters.from}T00:00:00`, STUDIO_TZ).getTime(),
    to: fromZonedTime(`${nextDay.toISOString().slice(0, 10)}T00:00:00`, STUDIO_TZ).getTime(),
  };
  if (!Number.isFinite(bounds.from) || !Number.isFinite(bounds.to) || bounds.from >= bounds.to)
    throw new Error("Período inválido.");
  return bounds;
}

function scopedRows<T extends { id: string; date: string; artistId: string | null }>(
  source: FinanceSource<T>,
  filters: WorkspaceFilters,
  bounds: { from: number; to: number } | null,
  isAdmin: boolean,
): { rows: T[]; available: boolean } {
  if (source.state !== "complete") return { rows: [], available: false };
  try {
    const rows = validateFinanceSource(source.rows);
    const dated = rows.map((row) => {
      const date = sourceTimestamp(row.date);
      if (date === null) throw new Error("Data financeira inválida.");
      return { row, date };
    });
    return {
      available: true,
      rows: dated
        .filter(({ row, date }) => {
          if (isAdmin && filters.artist !== "all" && row.artistId !== filters.artist) return false;
          return !bounds || (date >= bounds.from && date < bounds.to);
        })
        .sort((a, b) => b.date - a.date || a.row.id.localeCompare(b.row.id))
        .map(({ row }) => row),
    };
  } catch {
    return { rows: [], available: false };
  }
}

function validCents(value: unknown, positive = false): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && (positive ? value > 0 : value >= 0)
  );
}

function sumCents(
  values: Array<number | null | undefined>,
  available: boolean,
  positive = false,
): number | null {
  if (!available || values.some((value) => !validCents(value, positive))) return null;
  const sum = values.reduce<number>((total, value) => total + (value as number), 0);
  return Number.isSafeInteger(sum) ? sum : null;
}

function metric(
  label: string,
  value: number | null,
  kind: WorkspaceMetric["kind"],
  note: string,
): WorkspaceMetric {
  return { label, value, kind, note };
}

function projectMetrics(rows: FinanceProject[], available: boolean): WorkspaceMetric[] {
  return [
    metric(
      "Orçamentos cadastrados",
      sumCents(
        rows.map((row) => row.quotedCents),
        available,
        true,
      ),
      "money",
      "Orçamentos por data de cadastro. Venda ainda não confirmada.",
    ),
    metric(
      "Projetos cadastrados",
      available ? rows.length : null,
      "count",
      "Projetos únicos no recorte selecionado.",
    ),
    metric(
      "Sem oportunidade vinculada",
      available ? rows.filter((row) => !row.opportunityId?.trim()).length : null,
      "count",
      "Projetos com vínculo comercial a conferir.",
    ),
    metric(
      "Vendas Won",
      null,
      "money",
      "Fechamentos aguardam confirmação da data de ganho no GHL.",
    ),
  ];
}

function receiptMetrics(rows: FinanceReceipt[], available: boolean): WorkspaceMetric[] {
  const knownKinds = new Set(["sinal", "sessao", "saldo", "produto", "estorno"]);
  const valid =
    available && rows.every((row) => validCents(row.amountCents, true) && knownKinds.has(row.kind));
  const incoming = sumCents(
    rows.filter((row) => row.kind !== "estorno").map((row) => row.amountCents),
    valid,
    true,
  );
  const refunds = sumCents(
    rows.filter((row) => row.kind === "estorno").map((row) => row.amountCents),
    valid,
    true,
  );
  const net = incoming !== null && refunds !== null ? incoming - refunds : null;
  const unlinked = rows.filter((row) => !row.projectId?.trim()).length;
  const relationNote = available
    ? ` ${unlinked} lançamento(s) sem projeto vinculado.`
    : " Fonte indisponível.";
  return [
    metric(
      "Entradas registradas",
      incoming,
      "money",
      `Valores efetivamente lançados, incluindo sinais.${relationNote}`,
    ),
    metric(
      "Estornos registrados",
      refunds === null ? null : refunds === 0 ? 0 : -refunds,
      "money",
      "Deduzidos uma única vez das entradas.",
    ),
    metric(
      "Líquido registrado",
      net,
      "money",
      "Entradas menos estornos. Confirmação bancária pendente.",
    ),
    metric(
      "Recebimentos comprovados",
      null,
      "money",
      "Depende da conferência de comprovantes ou extratos.",
    ),
  ];
}

function includedSession(row: FinanceSession) {
  return (
    !row.excluded &&
    !["cancelled", "no_show", "noshow", "cancelado", "nao_compareceu"].includes(row.status)
  );
}

function sessionMetrics(
  rows: FinanceSession[],
  available: boolean,
  role: FinanceWorkspaceData["role"],
): WorkspaceMetric[] {
  const isAdmin = role === "admin";
  const included = rows.filter(includedSession);
  const includedNote = available ? ` ${included.length} sessão(ões) incluída(s).` : "";
  return [
    ...(isAdmin
      ? [
          metric(
            "Base cadastrada",
            sumCents(
              included.map((row) => row.amountCents),
              available,
            ),
            "money",
            `Valores de agenda, não recebimentos.${includedNote}`,
          ),
        ]
      : []),
    metric(
      isAdmin ? "Comissão tatuadores estimada" : "Comissão estimada",
      sumCents(
        included.map((row) => row.commissionCents),
        available,
      ),
      "money",
      `${role === "seller" ? "Estimativa com o percentual atual do cadastro do vendedor." : "Estimativa com o percentual cadastrado na sessão."} Realização a conferir.${includedNote}`,
    ),
    ...(isAdmin
      ? [
          metric(
            "Comissão vendedores estimada",
            sumCents(
              included.map((row) =>
                row.sellerId === null || row.sellerId === undefined
                  ? 0
                  : typeof row.sellerId === "string" && row.sellerId.trim()
                    ? row.sellerCommissionCents
                    : null,
              ),
              available,
            ),
            "money",
            "Estimativa com o percentual atual do cadastro do vendedor.",
          ),
        ]
      : [
          metric(
            "Sessões incluídas",
            available ? included.length : null,
            "count",
            "Consultas, cancelamentos e faltas ficam fora.",
          ),
        ]),
    metric("Comissão apurada", null, "money", "Depende da realização e do percentual aplicável."),
  ];
}

function payoutMetrics(): WorkspaceMetric[] {
  return [
    metric("Apurado", null, "money", "Depende da conferência das sessões e percentuais."),
    metric("Aprovado", null, "money", "Aprovações ainda não verificadas."),
    metric("Pago", null, "money", "Pagamentos à equipe ainda não verificados."),
  ];
}

/** Pure presentation model. Server-scoped rows remain authoritative; this never writes or creates links. */
export function buildFinanceWorkspace(
  data: FinanceWorkspaceData,
  filters: WorkspaceFilters,
  now = new Date(),
): FinanceWorkspaceModel {
  const isAdmin = data.role === "admin";
  const area: FinanceArea = isAdmin
    ? filters.area
    : filters.area === "payouts"
      ? "payouts"
      : "sessions";
  let bounds: { from: number; to: number } | null = null;
  let invalidPeriod = false;
  try {
    bounds = periodBounds(filters, now);
  } catch {
    invalidPeriod = true;
  }
  let projects: FinanceProject[] = [];
  let receipts: FinanceReceipt[] = [];
  let sessions: FinanceSession[] = [];
  let sourceAvailable = false;
  if (!invalidPeriod) {
    if (area === "projects") {
      const source = scopedRows(data.projects, filters, bounds, isAdmin);
      projects = source.rows;
      sourceAvailable = source.available;
    } else if (area === "receipts") {
      const source = scopedRows(data.receipts, filters, bounds, isAdmin);
      receipts = source.rows;
      sourceAvailable = source.available;
    } else if (area === "sessions") {
      const source = scopedRows(data.sessions, filters, bounds, isAdmin);
      // Explicit allowlist: gross and seller fields cannot escape through a non-admin model.
      sessions = source.rows.map((row) => {
        if (isAdmin) return row;
        return {
          id: row.id,
          client: row.client,
          artistId: row.artistId,
          artist: row.artist,
          date: row.date,
          status: row.status,
          projectId: row.projectId,
          commissionCents: row.commissionCents,
          commissionPct: row.commissionPct,
          excluded: row.excluded,
        };
      });
      sourceAvailable = source.available;
    }
  }
  const metrics =
    area === "projects"
      ? projectMetrics(projects, sourceAvailable)
      : area === "receipts"
        ? receiptMetrics(receipts, sourceAvailable)
        : area === "sessions"
          ? sessionMetrics(sessions, sourceAvailable, data.role)
          : payoutMetrics();
  return { area, metrics, projects, receipts, sessions, sourceAvailable, invalidPeriod };
}
