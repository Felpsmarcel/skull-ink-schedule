import type { CheckinStatus } from "@/lib/checkin.functions";

export const CHECKIN_STATUS_LABEL: Record<CheckinStatus, string> = {
  aguardando: "Aguardando atendimento",
  em_atendimento: "Em atendimento",
  concluido: "Atendimento concluído",
  nao_compareceu: "Não compareceu",
  cancelado: "Cancelado",
};

export function checkinTime(iso: string | null) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "Não informado";
  return new Date(iso).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Brussels",
  });
}

export function checkinRequestError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return /unauthorized|sessão da recepção/i.test(message)
    ? "Este check-in precisa do acesso da recepção. Peça à equipe para entrar no app e continuar."
    : fallback;
}
