import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { LOCATION_ID } from "@/config/staff";
import { useArtists } from "@/hooks/use-artists";
import {
  useAppointmentDraft,
  totalDurationMin,
  totalFinalEur,
  projectTotalEur,
  allSessionsScheduled,
  type ConfirmedDraftSession,
} from "@/stores/appointment-draft";
import { finalizeBooking, type FinalizeBookingSuccess } from "@/lib/booking.functions";
import { validateAppointmentDraft, reasonToI18nKey } from "@/lib/appointment-draft-validate";
import { formatPrice } from "@/lib/services";
import { sendTransactionalEmail } from "@/lib/email/send";
import { haptic } from "@/lib/haptics";
import { agendaLinkDay } from "@/lib/agenda-link-date";

export function useFinalizeAppointment() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draft = useAppointmentDraft();
  const { data: artists = [] } = useArtists();
  const [saving, setSaving] = useState(false);
  const book = useServerFn(finalizeBooking);

  async function run() {
    if (saving) return;
    if (draft.bookingCheckpoint?.sessions.length) {
      toast.warning(
        "Este rascunho já possui sessões confirmadas. É necessária revisão administrativa antes de continuar; nenhum agendamento foi reenviado.",
      );
      navigate({ to: "/appointments/new/revisao" });
      return;
    }
    const v = validateAppointmentDraft(draft, artists);
    if (!v.ok) {
      toast.error(t(reasonToI18nKey(v.reason)));
      return;
    }
    const { contact, staff, startISO, services, notes } = v.data;
    const confirmedSessions: ConfirmedDraftSession[] = [];
    const rememberSession = (
      session: number,
      sessionStart: string,
      result: FinalizeBookingSuccess,
    ) => {
      confirmedSessions.push({
        session,
        startISO: sessionStart,
        idempotencyKey: `appt-${draft.idempotencyKey}${session > 1 ? `-s${session}` : ""}`,
        appointmentId: result.appointmentId,
        ghlEventId: result.ghlEventId,
        projectId: result.projectId,
        ghlOpportunityId: result.ghlOpportunityId,
      });
      draft.setBookingCheckpoint({
        sessions: [...confirmedSessions],
        pendingSession: session < draft.sessionCount ? session + 1 : null,
        reason:
          "Finalização em andamento. Se o fluxo foi interrompido, confira os registros antes de continuar.",
      });
    };
    const stopPartial = (session: number | null, reason: string) => {
      const message = `${confirmedSessions.length} sessão(ões) confirmada(s). ${reason} Revisão administrativa necessária; o rascunho e os IDs foram preservados. Nenhuma sessão foi desfeita ou reenviada.`;
      draft.setBookingCheckpoint({
        sessions: [...confirmedSessions],
        pendingSession: session,
        reason: message,
      });
      toast.warning(message);
      navigate({ to: "/appointments/new/revisao" });
    };
    setSaving(true);
    try {
      const startMs = new Date(startISO).getTime();
      const durationMin = Math.max(15, totalDurationMin(draft) || 60);
      const endISO = new Date(startMs + durationMin * 60_000).toISOString();
      const baseTitle = services.map((l) => l.service.name).join(" + ");
      const sessionCount = Math.max(1, draft.sessionCount || 1);
      if (!allSessionsScheduled(draft)) {
        toast.error("Escolha a data de todas as sessões do projeto.");
        navigate({ to: "/appointments/new/agenda" });
        return;
      }
      const title = sessionCount > 1 ? `${baseTitle} (Sessão 1/${sessionCount})` : baseTitle;
      const serviceLines = services.map((l) => ({
        id: l.service.id,
        discountPct: l.discountPct,
        overridePriceEur: l.overridePriceEur ?? null,
      }));

      // Uma única chamada server-side orquestra contato → projeto → evento →
      // persistência, com chave de idempotência estável.
      const res = await book({
        data: {
          artistId: staff.id,
          calendarId: staff.calendarId,
          locationId: LOCATION_ID,
          startISO,
          endISO,
          title,
          notes: notes || null,
          status: "confirmed",
          services: serviceLines,
          sellerId: draft.sellerId ?? null,
          depositEur: draft.depositEur ?? 0,
          projectTotalEur: sessionCount > 1 ? projectTotalEur(draft) : null,
          contact: {
            ghlContactId: contact.id,
            name:
              contact.contactName ??
              ([contact.firstName, contact.lastName].filter(Boolean).join(" ") || null),
            phone: contact.phone ?? null,
            email: contact.email ?? null,
          },
          project: {
            decision: draft.project.decision === "new" ? "new" : "reuse",
            reuseProjectId: draft.project.reuseProjectId,
            reuseOpportunityId: draft.project.reuseOpportunityId,
            projectType: draft.project.projectType,
            description: draft.project.description.trim() || null,
            bodyPart: draft.project.bodyPart.trim() || null,
            confirmNew: draft.project.decision === "new",
          },
          idempotencyKey: `appt-${draft.idempotencyKey}`,
        },
      });

      if (res.kind === "contact_conflict") {
        toast.error(res.reason);
        navigate({ to: "/appointments/new/cliente" });
        return;
      }
      rememberSession(1, startISO, res);
      for (const warning of res.warnings) toast.warning(warning);

      // Sessões 2..N: mesmo projeto/oportunidade, sem sinal, chave própria por sessão.
      if (sessionCount > 1) {
        if (!res.projectId) {
          stopPartial(2, "A sessão 1 foi criada, mas o projeto não foi vinculado.");
          return;
        } else {
          for (let i = 0; i < draft.extraStarts.length; i++) {
            const sIso = draft.extraStarts[i]!;
            const sMs = new Date(sIso).getTime();
            try {
              const extraResult = await book({
                data: {
                  artistId: staff.id,
                  calendarId: staff.calendarId,
                  locationId: LOCATION_ID,
                  startISO: sIso,
                  endISO: new Date(sMs + durationMin * 60_000).toISOString(),
                  title: `${baseTitle} (Sessão ${i + 2}/${sessionCount})`,
                  notes: notes || null,
                  status: "confirmed",
                  services: serviceLines,
                  sellerId: draft.sellerId ?? null,
                  depositEur: 0,
                  projectTotalEur: null,
                  contact: {
                    ghlContactId: res.ghlContactId ?? contact.id,
                    name:
                      contact.contactName ??
                      ([contact.firstName, contact.lastName].filter(Boolean).join(" ") || null),
                    phone: contact.phone ?? null,
                    email: contact.email ?? null,
                  },
                  project: {
                    decision: "reuse",
                    reuseProjectId: res.projectId,
                    reuseOpportunityId: res.ghlOpportunityId,
                    projectType: draft.project.projectType,
                    description: draft.project.description.trim() || null,
                    bodyPart: draft.project.bodyPart.trim() || null,
                    confirmNew: false,
                  },
                  idempotencyKey: `appt-${draft.idempotencyKey}-s${i + 2}`,
                },
              });
              if (extraResult.kind === "contact_conflict") {
                stopPartial(
                  i + 2,
                  `Sessão ${i + 2}/${sessionCount} não confirmada: ${extraResult.reason}`,
                );
                return;
              }
              rememberSession(i + 2, sIso, extraResult);
              for (const warning of extraResult.warnings) toast.warning(warning);
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              stopPartial(i + 2, `Sessão ${i + 2}/${sessionCount} não confirmada: ${msg}`);
              return;
            }
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["agenda"] });
      await queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["home-dashboard"] });
      const final = totalFinalEur(draft);
      haptic("success");
      toast.success(`${t("appt.created")} · ${formatPrice(final)}`);

      // Fire-and-forget notification emails. Failures never abort the flow.
      const whenLabel = new Intl.DateTimeFormat("pt-PT", {
        timeZone: "Europe/Brussels",
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(startISO));
      const servicesSummary = services.map((l) => l.service.name).join(", ");
      const clientName =
        contact.contactName ??
        [contact.firstName, contact.lastName].filter(Boolean).join(" ") ??
        null;
      const agendaUrl = `${window.location.origin}/agenda`;
      const totalLabel = formatPrice(final);
      const commissionLabel = formatPrice(
        Math.round(final * (res.commissionPct / 100) * 100) / 100,
      );

      if (contact.email) {
        void sendTransactionalEmail({
          templateName: "appointment-confirmation",
          recipientEmail: contact.email,
          idempotencyKey: `appt-confirm-${res.appointmentId}`,
          templateData: {
            clientName,
            artistName: staff.name,
            servicesSummary,
            whenLabel,
            totalLabel,
            agendaUrl,
          },
        });
      }
      if (staff.email) {
        void sendTransactionalEmail({
          templateName: "artist-new-booking",
          recipientEmail: staff.email,
          idempotencyKey: `appt-artist-${res.appointmentId}`,
          templateData: {
            artistName: staff.name,
            clientName,
            clientPhone: contact.phone ?? undefined,
            servicesSummary,
            whenLabel,
            commissionLabel,
            notes: notes || undefined,
            agendaUrl,
          },
        });
      }

      const created = res.ghlEventId;
      draft.reset();
      navigate({
        to: "/agenda",
        search: { date: agendaLinkDay(startISO), ...(created ? { novo: created } : {}) },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (confirmedSessions.length) {
        stopPartial(null, `O fluxo de finalização foi interrompido: ${msg}`);
        return;
      }
      const slotTaken =
        /slot.*(no longer|not).*available|no longer available|deixou de estar disponível|neste horário/i.test(
          msg,
        );
      if (slotTaken) {
        toast.error(t("appt.errors.slotTaken"));
        draft.setStart(null);
        navigate({ to: "/appointments/new/agenda" });
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return { run, saving };
}
