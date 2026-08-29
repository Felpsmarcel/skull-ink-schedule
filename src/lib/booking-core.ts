/**
 * Fase 3 — núcleo puro da criação de agendamento.
 *
 * Sem imports de servidor/banco: só decisões determinísticas, para poderem
 * ser testadas e reutilizadas pelo orquestrador server-side.
 */
import { normalizeEmail, normalizePhone, samePhone } from "@/lib/linking";

/* ------------------------------ Contato ------------------------------ */

export interface ContactCandidate {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

export type ContactResolution =
  | { kind: "reuse"; contact: ContactCandidate }
  | { kind: "create" }
  | { kind: "conflict"; candidates: ContactCandidate[]; reason: string };

/**
 * Decide o que fazer com os candidatos devolvidos pelo GHL.
 * Pesquisa primeiro por telefone, depois por e-mail. Quando telefone e
 * e-mail apontam para contatos diferentes (ou há vários compatíveis), pára
 * e exige seleção humana — nunca escolhe silenciosamente.
 */
export function resolveContactMatch(input: {
  phone?: string | null;
  email?: string | null;
  candidates: ContactCandidate[];
}): ContactResolution {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);

  const byPhone = phone ? input.candidates.filter((c) => samePhone(c.phone, phone)) : [];
  const byEmail = email
    ? input.candidates.filter((c) => normalizeEmail(c.email) === email)
    : [];

  if (byPhone.length > 1) {
    return {
      kind: "conflict",
      candidates: byPhone,
      reason: "Vários contatos no CRM com este telefone. Selecione manualmente.",
    };
  }
  if (byEmail.length > 1) {
    return {
      kind: "conflict",
      candidates: byEmail,
      reason: "Vários contatos no CRM com este e-mail. Selecione manualmente.",
    };
  }

  const p = byPhone[0] ?? null;
  const e = byEmail[0] ?? null;

  if (p && e && p.id !== e.id) {
    return {
      kind: "conflict",
      candidates: [p, e],
      reason:
        "O telefone pertence a um contato e o e-mail a outro no CRM. Selecione qual usar.",
    };
  }
  const hit = p ?? e;
  if (hit) return { kind: "reuse", contact: hit };
  return { kind: "create" };
}

/** Campos a atualizar num contato reutilizado: só os fornecidos e não vazios. */
export function contactUpdatePatch(
  existing: ContactCandidate,
  provided: { name?: string | null; phone?: string | null; email?: string | null },
): Record<string, string> {
  const patch: Record<string, string> = {};
  const name = provided.name?.trim();
  if (name && name !== (existing.name ?? "").trim()) patch["name"] = name;
  const phone = normalizePhone(provided.phone);
  if (phone && !samePhone(existing.phone, phone)) patch["phone"] = phone;
  const email = normalizeEmail(provided.email);
  if (email && email !== normalizeEmail(existing.email)) patch["email"] = email;
  return patch;
}

/* ------------------------------ Intervalo ------------------------------ */

export type IntervalError =
  | "invalidStart"
  | "invalidEnd"
  | "endBeforeStart"
  | "tooShort"
  | "tooLong"
  | "past";

export function validateBookingInterval(
  startISO: string,
  endISO: string,
  now = Date.now(),
): { ok: true; startMs: number; endMs: number } | { ok: false; reason: IntervalError } {
  const startMs = Date.parse(startISO);
  const endMs = Date.parse(endISO);
  if (!Number.isFinite(startMs)) return { ok: false, reason: "invalidStart" };
  if (!Number.isFinite(endMs)) return { ok: false, reason: "invalidEnd" };
  if (endMs <= startMs) return { ok: false, reason: "endBeforeStart" };
  const min = endMs - startMs;
  if (min < 10 * 60_000) return { ok: false, reason: "tooShort" };
  if (min > 14 * 3600_000) return { ok: false, reason: "tooLong" };
  // Tolerância de 12h para lançamentos operacionais do próprio dia.
  if (startMs < now - 12 * 3600_000) return { ok: false, reason: "past" };
  return { ok: true, startMs, endMs };
}

export function intervalErrorMessage(r: IntervalError): string {
  switch (r) {
    case "invalidStart":
    case "invalidEnd":
      return "Data/hora inválida.";
    case "endBeforeStart":
      return "O fim do agendamento deve ser depois do início.";
    case "tooShort":
      return "Duração mínima de 10 minutos.";
    case "tooLong":
      return "Duração máxima de 14 horas.";
    case "past":
      return "Não é possível agendar no passado.";
  }
}

/** Sobreposição de intervalos (fim exclusivo). */
export function overlaps(
  aStart: string | number,
  aEnd: string | number,
  bStart: string | number,
  bEnd: string | number,
): boolean {
  const as = typeof aStart === "number" ? aStart : Date.parse(aStart);
  const ae = typeof aEnd === "number" ? aEnd : Date.parse(aEnd);
  const bs = typeof bStart === "number" ? bStart : Date.parse(bStart);
  const be = typeof bEnd === "number" ? bEnd : Date.parse(bEnd);
  return as < be && bs < ae;
}

/** Confere se o início pedido está numa lista de free-slots do GHL. */
export function slotIsFree(startISO: string, slots: string[]): boolean {
  const target = Date.parse(startISO);
  return slots.some((s) => {
    const v = Date.parse(s);
    return Number.isFinite(v) && Math.abs(v - target) < 60_000;
  });
}

/* ------------------------------ Preços ------------------------------ */

export interface CatalogService {
  id: string;
  name: string;
  duration_min: number;
  modality: string;
  price_eur: number;
  price_on_request: boolean;
}

export interface RequestedLine {
  id: string;
  discountPct: number;
  overridePriceEur?: number | null;
}

export interface PricedLine {
  id: string;
  name: string;
  duration_min: number;
  modality: string;
  price_eur: number;
  discount_pct: number;
  final_eur: number;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function priceServiceLines(
  requested: RequestedLine[],
  catalog: Map<string, CatalogService>,
): { lines: PricedLine[]; originalEur: number; totalEur: number } {
  const lines = requested.map((s) => {
    const svc = catalog.get(s.id);
    if (!svc) throw new Error(`Serviço inexistente: ${s.id}`);
    const basePrice = svc.price_on_request
      ? Number(s.overridePriceEur ?? 0)
      : Number(s.overridePriceEur ?? svc.price_eur);
    if (svc.price_on_request && !(basePrice > 0)) {
      throw new Error(`Informe o valor do serviço "${svc.name}"`);
    }
    return {
      id: svc.id,
      name: svc.name,
      duration_min: svc.duration_min,
      modality: svc.modality,
      price_eur: basePrice,
      discount_pct: s.discountPct,
      final_eur: round2(basePrice * (1 - s.discountPct / 100)),
    };
  });
  return {
    lines,
    originalEur: round2(lines.reduce((a, l) => a + l.price_eur, 0)),
    totalEur: round2(lines.reduce((a, l) => a + l.final_eur, 0)),
  };
}

/* --------------------------- Estado da operação --------------------------- */

export type BookingStep =
  | "validated"
  | "contact"
  | "project"
  | "calendar"
  | "event"
  | "persisted";

export type BookingStatus =
  | "in_progress"
  | "done"
  | "failed"
  | "reconciliation_required"
  | "needs_selection";

/**
 * Deriva o estado a gravar na operação: se o evento já existe no GHL mas a
 * persistência local falhou, a operação é reconciliável (nunca recria evento).
 */
export function bookingOutcome(input: {
  ghlAppointmentId: string | null;
  persisted: boolean;
  failed: boolean;
}): { step: BookingStep; status: BookingStatus } {
  if (input.persisted) return { step: "persisted", status: "done" };
  if (input.ghlAppointmentId) return { step: "event", status: "reconciliation_required" };
  return { step: input.failed ? "event" : "calendar", status: "failed" };
}

/** Mensagem de erro que diz a etapa e o que já foi criado no CRM. */
export function bookingErrorMessage(input: {
  step: BookingStep;
  detail: string;
  ghlContactId?: string | null;
  ghlOpportunityId?: string | null;
  ghlAppointmentId?: string | null;
}): string {
  const created: string[] = [];
  if (input.ghlContactId) created.push(`contato ${input.ghlContactId}`);
  if (input.ghlOpportunityId) created.push(`oportunidade ${input.ghlOpportunityId}`);
  if (input.ghlAppointmentId) created.push(`evento ${input.ghlAppointmentId}`);
  const labels: Record<BookingStep, string> = {
    validated: "Validação",
    contact: "Contato",
    project: "Projeto/Oportunidade",
    calendar: "Calendário",
    event: "Criação do evento",
    persisted: "Gravação local",
  };
  const tail = created.length
    ? ` Já existe no CRM: ${created.join(", ")}. Reenvie para reconciliar sem duplicar.`
    : "";
  return `Falhou na etapa "${labels[input.step]}": ${input.detail}.${tail}`;
}
