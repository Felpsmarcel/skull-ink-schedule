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
export const TRACEABILITY_ACTIVATED_AT = "2026-08-29T14:37:33.000Z";

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

/* ------------------------- Escopo por artista ------------------------- */

/**
 * Escopo de dados do utilizador. `none` é fail-closed: artista sem
 * artist_id vinculado não pode ver nada (nem a operação global).
 */
export type ArtistScope =
  | { kind: "all" }
  | { kind: "artist"; artistId: string }
  | { kind: "none" };

export function resolveArtistScope(
  role: HomeRole,
  artistId: string | null | undefined,
): ArtistScope {
  if (role !== "artist") return { kind: "all" };
  const id = typeof artistId === "string" ? artistId.trim() : "";
  if (!id) return { kind: "none" };
  return { kind: "artist", artistId: id };
}

/** Filtro estrito: linhas sem artist_id ou de outro artista são excluídas. */
export function filterByScope<T>(
  rows: T[],
  scope: ArtistScope,
  getArtistId: (row: T) => string | null | undefined,
): T[] {
  if (scope.kind === "none") return [];
  if (scope.kind === "all") return rows;
  return rows.filter((row) => {
    const id = getArtistId(row);
    return typeof id === "string" && id === scope.artistId;
  });
}

/* ---------------------------- Ações por perfil ---------------------------- */

export interface HomeActions {
  agenda: boolean;
  checkin: boolean;
  pagamento: boolean;
  financeiro: boolean;
  gestao: boolean;
  /** Link "Ver todos" da fila só para quem gere a operação global. */
  filaVerTodos: boolean;
}

export function homeActions(role: HomeRole): HomeActions {
  if (role === "artist") {
    return {
      agenda: true,
      checkin: false,
      pagamento: false,
      financeiro: false,
      gestao: false,
      filaVerTodos: false,
    };
  }
  if (role === "recepcao") {
    return {
      agenda: true,
      checkin: true,
      pagamento: true,
      financeiro: false,
      gestao: false,
      filaVerTodos: true,
    };
  }
  return {
    agenda: true,
    checkin: true,
    pagamento: true,
    financeiro: true,
    gestao: true,
    filaVerTodos: true,
  };
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
  /** Escopo explícito (prevalece sobre `artistId`). */
  scope?: ArtistScope;
}

/**
 * Próximo cliente do dia: o agendamento ainda não terminado, mais próximo
 * no tempo, ignorando cancelados/no-show e outros dias.
 */
export function selectNextAppointment(
  candidates: NextCandidate[],
  opts: SelectNextOptions,
): NextCandidate | null {
  const scope: ArtistScope =
    opts.scope ?? (opts.artistId ? { kind: "artist", artistId: opts.artistId } : { kind: "all" });
  const eligible = filterByScope(candidates, scope, (c) => c.artistId)
    .filter((c) => !CANCELLED.has(c.status))
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

export interface HomeFilaItem {
  /** Código curto do atendimento (não é ID técnico do registo). */
  codigo: string;
  clientName: string;
  status: "aguardando" | "em_atendimento";
  /** Hora de chegada/agendada, já formatada no fuso do estúdio. */
  timeLabel: string;
  esperaMin: number;
  artistName: string | null;
}

export const MAX_FILA_HOME = 4;

export interface HomeFila {
  aguardando: number;
  emAtendimento: number;
  /** Lista curta já filtrada por papel no servidor (máximo 4). */
  itens: HomeFilaItem[];
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
  actions: HomeActions;
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

/* ------------------------------ Fila do dia ------------------------------ */

export interface FilaSource {
  codigo: string;
  clienteNome: string | null;
  status: string;
  arrivedAt: string | null;
  scheduledAt: string | null;
  artistId: string | null;
  artistName: string | null;
}

const FILA_ATIVA = new Set(["aguardando", "em_atendimento"]);

/**
 * Fila ativa compacta: filtrada por escopo (fail-closed para artista sem
 * vínculo), "em atendimento" primeiro, depois por chegada, limitada a 4.
 * Nunca inclui telefone, e-mail ou IDs técnicos.
 */
export function buildFilaItems(
  rows: FilaSource[],
  scope: ArtistScope,
  nowMs: number,
  limit: number = MAX_FILA_HOME,
): HomeFilaItem[] {
  return filterByScope(rows, scope, (r) => r.artistId)
    .filter((r) => FILA_ATIVA.has(r.status))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "em_atendimento" ? -1 : 1;
      return Date.parse(a.arrivedAt ?? "") - Date.parse(b.arrivedAt ?? "");
    })
    .slice(0, limit)
    .map((r) => {
      const ref = r.arrivedAt ?? r.scheduledAt;
      const refMs = ref ? Date.parse(ref) : Number.NaN;
      return {
        codigo: r.codigo,
        clientName: r.clienteNome?.trim() || "Cliente sem nome",
        status: r.status as HomeFilaItem["status"],
        timeLabel: ref && !Number.isNaN(refMs) ? brusselsTime(ref) : "—",
        esperaMin: Number.isNaN(refMs) ? 0 : Math.max(0, Math.round((nowMs - refMs) / 60000)),
        artistName: r.artistName,
      };
    });
}
