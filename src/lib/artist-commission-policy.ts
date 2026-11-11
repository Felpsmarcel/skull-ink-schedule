/**
 * Política de comissão por data de REALIZAÇÃO da sessão (Europe/Brussels).
 * Preparado na prévia; ainda NÃO ligado a telas, sync ou finalização.
 *
 * - A data efetiva é o dia civil em Bruxelas do início da sessão; nunca venda,
 *   pagamento ou criação do registro.
 * - Sessões antes do período coberto e outros artistas mantêm o percentual já gravado.
 * - Repasses pagos/congelados mantêm o percentual gravado.
 * - Sessão não realizada é só estimativa (não reconhece ganho).
 * - Consulta/Randevu não é sessão e não gera comissão.
 * Valores em centavos inteiros; arredondamento half-up por sessão.
 */
import { formatInTimeZone } from "date-fns-tz";

export const COMMISSION_TZ = "Europe/Brussels";

/** ID imutável do cadastro de André Pareyn (verificado por leitura). Nunca autorizar por e-mail. */
export const ANDRE_PAREYN_ARTIST_ID = "8489abdc-3a9a-4114-85a1-a4947da979df";

/** Calendário Randevu compartilhado (consultas), por ID configurado. */
export const RANDEVU_CALENDAR_ID = "NzAYeRNJnvfpu7ynyoEK";

export interface CommissionPeriod {
  /** Dia civil inclusivo, yyyy-MM-dd. */
  from: string;
  /** Dia civil inclusivo, yyyy-MM-dd; null = em aberto. */
  to: string | null;
  pct: number;
}

export const ARTIST_COMMISSION_SCHEDULE: Readonly<Record<string, readonly CommissionPeriod[]>> = {
  [ANDRE_PAREYN_ARTIST_ID]: [
    { from: "2026-11-01", to: "2026-11-30", pct: 35 },
    { from: "2026-12-01", to: null, pct: 40 },
  ],
};

export function brusselsCivilDate(iso: string): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return formatInTimeZone(new Date(ms), COMMISSION_TZ, "yyyy-MM-dd");
}

export interface SessionCommissionInput {
  artistId: string;
  startAt: string;
  status: string;
  /** Percentual já gravado no agendamento. */
  snapshotPct: number | string | null;
  /** Repasse já pago/congelado: nunca recalcular. */
  frozen?: boolean;
  /** Consulta (ex.: Randevu) não é sessão de tatuagem. */
  isConsultation?: boolean;
  calendarId?: string | null;
  /** Evidência de realização (ex.: fim do check-in). Sem ela, nada é reconhecido. */
  realizedAt?: string | null;
}

export type CommissionSource = "policy" | "snapshot" | "frozen" | "not_session";

export interface SessionCommission {
  pct: number | null;
  source: CommissionSource;
  /** true somente com status concluído E data de realização comprovada. */
  recognized: boolean;
  effectiveDate: string | null;
  /** "realized" = data comprovada; "scheduled" = agenda, só para estimativa. */
  dateSource: "realized" | "scheduled";
  completedWithoutEvidence: boolean;
}

function toPct(v: number | string | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

export function resolveSessionCommission(s: SessionCommissionInput): SessionCommission {
  const realized = s.realizedAt ? brusselsCivilDate(s.realizedAt) : null;
  const effectiveDate = realized ?? brusselsCivilDate(s.startAt);
  const dateSource: "realized" | "scheduled" = realized ? "realized" : "scheduled";
  const base = {
    effectiveDate,
    dateSource,
    completedWithoutEvidence: s.status === "completed" && !realized,
  };
  if (s.isConsultation || (s.calendarId != null && s.calendarId === RANDEVU_CALENDAR_ID)) {
    return { pct: null, source: "not_session", recognized: false, ...base };
  }
  if (s.status === "cancelled") {
    return { pct: null, source: "not_session", recognized: false, ...base };
  }
  const recognized = s.status === "completed" && realized !== null;
  const snapshot = toPct(s.snapshotPct);
  if (s.frozen) return { pct: snapshot, source: "frozen", recognized, ...base };
  const schedule = ARTIST_COMMISSION_SCHEDULE[s.artistId];
  if (schedule && effectiveDate) {
    const period = schedule.find(
      (p) => effectiveDate >= p.from && (p.to === null || effectiveDate <= p.to),
    );
    if (period) return { pct: period.pct, source: "policy", recognized, ...base };
  }
  return { pct: snapshot, source: "snapshot", recognized, ...base };
}

/** Parte do artista sobre a base elegível da sessão; null se base/percentual não apurados. */
export function sessionArtistShareCents(
  baseCents: number | null,
  pct: number | null,
): number | null {
  if (baseCents === null || pct === null || !Number.isInteger(baseCents) || baseCents < 0)
    return null;
  return Math.round((baseCents * pct) / 100);
}

export interface CommissionViewer {
  role: "admin" | "artist" | "seller" | null;
  /** artist_id resolvido no servidor (app_users), nunca enviado pelo cliente. */
  artistId: string | null;
}

/** Admin vê todas; artista só a própria; demais negados. */
export function canViewArtistCommission(
  viewer: CommissionViewer | null,
  targetArtistId: string,
): boolean {
  if (!viewer) return false;
  if (viewer.role === "admin") return true;
  return viewer.role === "artist" && !!viewer.artistId && viewer.artistId === targetArtistId;
}

/** Projeção operacional do Randevu para equipe: sem notas, finanças nem outros calendários. */
export interface RandevuRow {
  id: string;
  calendarId: string | null;
  startAt: string;
  endAt: string;
  status: string;
  contactName: string | null;
  [k: string]: unknown;
}
export function projectSharedRandevu(rows: RandevuRow[]) {
  return rows
    .filter((r) => r.calendarId === RANDEVU_CALENDAR_ID)
    .map((r) => ({
      id: r.id,
      startAt: r.startAt,
      endAt: r.endAt,
      status: r.status,
      contactName: r.contactName,
    }));
}
