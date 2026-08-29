/**
 * Pure helpers for Fase 2 (rastreabilidade GHL ↔ APP).
 *
 * Kept free of server imports so they can be unit-tested and reused on the
 * client. Nothing here touches the database or the GHL token.
 */

/** HighLevel oficial da GF Tattoo. */
export const GF_LOCATION_ID = "9iqrKUVPDddINb9S4Iwd";
/** Pipeline oficial "GF Tattoo — Jornada Comercial". */
export const GF_PIPELINE_ID = "zXlQtkgkxbDMMNp9yqLB";

export type ProjectType = "new_tattoo" | "cover_up" | "retouch";

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  new_tattoo: "Tatuagem nova",
  cover_up: "Cover-up",
  retouch: "Retoque",
};

/**
 * Normaliza telefone para comparação/pesquisa no GHL: remove caracteres
 * invisíveis (iOS), espaços e pontuação, converte prefixo "00" em "+".
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "");
  s = s.replace(/[\s()\-.]/g, "");
  if (/^00\d/.test(s)) s = `+${s.slice(2)}`;
  s = s.replace(/(?!^\+)[^\d]/g, "");
  return s.length >= 6 ? s : null;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  return /.+@.+\..+/.test(s) ? s : null;
}

/** Últimos dígitos usados para casar telefones com formatações diferentes. */
export function phoneTail(raw: string | null | undefined, n = 9): string | null {
  const p = normalizePhone(raw);
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  return digits.length >= n ? digits.slice(-n) : digits;
}

export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = phoneTail(a);
  const tb = phoneTail(b);
  return Boolean(ta && tb && ta === tb);
}

/* ---------------------- Badges de auditoria ---------------------- */

export type LinkStatus = "vinculado" | "vinculo_incompleto" | "sem_oportunidade" | "sem_pagamento";

export const LINK_STATUS_LABELS: Record<LinkStatus, string> = {
  vinculado: "Vinculado",
  vinculo_incompleto: "Vínculo incompleto",
  sem_oportunidade: "Sem oportunidade",
  sem_pagamento: "Sem pagamento",
};

export interface LinkFacts {
  projectId: string | null;
  ghlOpportunityId: string | null;
  ghlAppointmentId: string | null;
  hasPayment: boolean;
}

/**
 * Deriva o badge de auditoria de um agendamento. A ordem importa: falta de
 * projeto/appointment no CRM é mais grave que falta de pagamento.
 */
export function appointmentLinkStatus(f: LinkFacts): LinkStatus {
  if (!f.projectId || !f.ghlAppointmentId) return "vinculo_incompleto";
  if (!f.ghlOpportunityId) return "sem_oportunidade";
  if (!f.hasPayment) return "sem_pagamento";
  return "vinculado";
}

/* ---------------------- Validação de pagamento ---------------------- */

export type PaymentLinkReason = "missingProject" | "missingJustification";

export interface PaymentLinkInput {
  tipo: string;
  projectId?: string | null;
  appointmentId?: string | null;
  semVinculoJustificativa?: string | null;
}

export type PaymentLinkValidation = { ok: true } | { ok: false; reason: PaymentLinkReason };

/** Tipos que exigem vínculo com projeto/agendamento. */
export const TIPOS_QUE_EXIGEM_VINCULO = ["sinal", "sessao"];

/**
 * Sinal e sessão precisam de projeto (e do agendamento quando existir).
 * Lançar sem vínculo só é permitido com justificativa explícita.
 */
export function validatePaymentLink(input: PaymentLinkInput): PaymentLinkValidation {
  const exige = TIPOS_QUE_EXIGEM_VINCULO.includes(input.tipo);
  const linked = Boolean(input.projectId || input.appointmentId);
  if (!exige || linked) return { ok: true };
  const justification = (input.semVinculoJustificativa ?? "").trim();
  if (justification.length < 10) {
    return { ok: false, reason: justification ? "missingJustification" : "missingProject" };
  }
  return { ok: true };
}

export function paymentLinkReasonMessage(r: PaymentLinkReason): string {
  switch (r) {
    case "missingProject":
      return "Sinal e sessão precisam de projeto/agendamento. Sem vínculo, escreva uma justificativa.";
    case "missingJustification":
      return "A justificativa para lançar sem vínculo precisa de pelo menos 10 caracteres.";
  }
}
