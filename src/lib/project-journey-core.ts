import type { AppointmentLinkInfo, ProjectDetail } from "@/lib/projects.functions";

/** Only immutable local links qualify; no contact/name/opportunity search fallback. */
export function projectJourney(link: AppointmentLinkInfo, project: ProjectDetail | null) {
  if (!link.appointmentId || !link.projectId) return { state: "absent" as const, project: null };
  if (!project || project.id !== link.projectId || !project.sessions.some((s) => s.id === link.appointmentId)) {
    return { state: "unverified" as const, project: null };
  }
  return {
    state: link.ghlAppointmentId && link.ghlOpportunityId ? "confirmed" as const : "incomplete" as const,
    project,
  };
}

/** A missing future appointment says nothing about completion or abandonment. */
export function projectContinuity(nextStartAt: string | null) {
  return nextStartAt && Number.isFinite(Date.parse(nextStartAt))
    ? { state: "scheduled" as const, startAt: nextStartAt }
    : { state: "verify" as const, startAt: null };
}

export function formatProjectDate(value: string) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "Data não verificada";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "Europe/Brussels", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(ms);
}

export const PROJECT_APPOINTMENT_STATUS: Record<string, string> = {
  pending: "Agendado", confirmed: "Confirmado", completed: "Conclusão registrada",
  no_show: "Ausência registrada", cancelled: "Cancelado",
};