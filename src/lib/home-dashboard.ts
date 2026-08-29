/**
 * Fase 4 — lógica pura do painel operacional da Home.
 *
 * Nada aqui toca banco de dados ou GHL: o objetivo é permitir testes
 * unitários da seleção do "próximo cliente", do fuso Europe/Brussels,
 * da priorização das pendências administrativas e da filtragem por perfil.
 */

export const HOME_TZ = "Europe/Brussels";

/**
 * Marco de ativação da rastreabilidade (Fase 2).
 * Registros criados a partir desta data são considerados falha operacional
 * nova; anteriores são legado/histórico e só aparecem no detalhe de Gestão.
 */
export const TRACEABILITY_ACTIVATED_AT = "2026-08-28T00:00:00.000Z";

export type HomeRole = "admin" | "recepcao" | "artist";

/** Papéis do app → papéis da Home. `seller` opera como recepção. */
export function homeRole(role: string | null | undefined): HomeRole {
  if (role === "admin") return "admin";
  if (role === "artist") return "artist";
  return "recepcao";
}

/** Somente admin vê valores financeiros globais e pendências de gestão. */
export function canSeeFinance(role: HomeRole): boolean {
  return role === "admin";
}

export function canSeeGestao(role: HomeRole): boolean {
  return role === "admin";
}

/* ------------------------- Próximo cliente ------------------------- */

export interface NextCandidate {
  id: string;
  ghlAppointmentId: string | null;
  startAt: string;
  endAt: string;
  status: string;
  clientName: string | null;
  artistId: string;
  artistName: string | null;
}

const CANCELLED = new Set(["cancelled", "no_show", "noshow"]);

export interface SelectNextOptions {
  nowMs: number;
  /** Fim do dia (Brussels) em ms. Só consideramos o dia corrente. */
  dayEndMs: number;
  /** Quando presente, restringe ao artista (visão do tatuador). */
  artistId?: string | null;
}

/**
 * Próximo cliente do dia: o agendamento ainda não terminado, mais próximo
 * no tempo, ignorando cancelados/no-show e outros dias.
 */
export function selectNextAppointment(
  candidates: NextCandidate[],
  opts: SelectNextOptions,
): NextCandidate | null {
  const eligible = candidates
    .filter((c) => !CANCELLED.has(c.status))
    .filter((c) => !opts.artistId || c.artistId === opts.artistId)
    .filter((c) => {
      const start = Date.parse(c.startAt);
      const end = Date.parse(c.endAt);
      if (Number.isNaN(start) || Number.isNaN(end)) return false;
      return end >= opts.nowMs && start <= opts.dayEndMs;
    })
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  return eligible[0] ?? null;
}

/** Horário curto no fuso do estúdio. */
export function brusselsTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: HOME_TZ,
  });
}

/** Data longa ("sábado, 29 de agosto") no fuso do estúdio. */
export function brusselsToday(now: Date = new Date()): string {
  return now.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: HOME_TZ,
  });
}

/* --------------------- Pendências administrativas --------------------- */

export type PendenciaKind =
  | "reconciliation"
  | "vinculos"
  | "sessoes_sem_pagamento"
  | "passados_confirmados";

export type PendenciaSeverity = "critica" | "atencao";

export interface Pendencia {
  kind: PendenciaKind;
  label: string;
  count: number;
  severity: PendenciaSeverity;
  to: string;
}

const SEVERITY_ORDER: Record<PendenciaSeverity, number> = { critica: 0, atencao: 1 };
const KIND_ORDER: PendenciaKind[] = [
  "reconciliation",
  "vinculos",
  "sessoes_sem_pagamento",
  "passados_confirmados",
];

export const MAX_PENDENCIAS_VISIVEIS = 3;

/**
 * Mantém apenas pendências com contagem > 0, ordena por gravidade (críticas
 * primeiro), depois pela ordem funcional e pela contagem, e limita a 3.
 */
export function prioritizePendencias(list: Pendencia[]): Pendencia[] {
  return list
    .filter((p) => p.count > 0)
    .sort((a, b) => {
      const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sev !== 0) return sev;
      const kind = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
      if (kind !== 0) return kind;
      return b.count - a.count;
    })
    .slice(0, MAX_PENDENCIAS_VISIVEIS);
}

/* --------------------------- Payload da Home --------------------------- */

export interface HomeNextClient {
  ghlAppointmentId: string | null;
  timeLabel: string;
  clientName: string;
  artistName: string | null;
  status: string;
}

export interface HomeFila {
  aguardando: number;
  emAtendimento: number;
}

export interface HomeGestao {
  /** Recebido hoje (soma das movimentações do dia), em EUR. */
  recebidoHoje: number;
  pendencias: Pendencia[];
  /** Total histórico de vínculos incompletos (contexto, não alerta). */
  vinculosHistorico: number;
  vinculosNovos: number;
  marcoRastreabilidade: string;
  /** Bloco de gestão degradou (falha parcial) mas a operação carregou. */
  degraded: boolean;
}

export interface HomeDashboard {
  role: HomeRole;
  dateLabel: string;
  updatedAtISO: string;
  next: HomeNextClient | null;
  fila: HomeFila;
  /** Presente somente para admin — nunca enviado a outros perfis. */
  gestao?: HomeGestao;
}

/**
 * Garante que nenhum dado administrativo saia no payload de perfis sem
 * autorização (defesa no servidor, não apenas no CSS).
 */
export function stripUnauthorized(dashboard: HomeDashboard): HomeDashboard {
  if (canSeeGestao(dashboard.role)) return dashboard;
  const { gestao: _gestao, ...rest } = dashboard;
  return rest;
}
