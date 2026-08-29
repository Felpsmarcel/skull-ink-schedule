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
} from "@/stores/appointment-draft";
import { finalizeBooking } from "@/lib/booking.functions";
import {
  validateAppointmentDraft,
  reasonToI18nKey,
} from "@/lib/appointment-draft-validate";
import { formatPrice } from "@/lib/services";
import { sendTransactionalEmail } from "@/lib/email/send";
import { haptic } from "@/lib/haptics";

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
    const v = validateAppointmentDraft(draft, artists);
    if (!v.ok) {
      toast.error(t(reasonToI18nKey(v.reason)));
      return;
    }
    const { contact, staff, startISO, services, notes } = v.data;
    setSaving(true);
    try {
      const startMs = new Date(startISO).getTime();
      const durationMin = Math.max(15, totalDurationMin(draft) || 60);
      const endISO = new Date(startMs + durationMin * 60_000).toISOString();
      const title = services.map((l) => l.service.name).join(" + ");

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
          services: services.map((l) => ({
            id: l.service.id,
            discountPct: l.discountPct,
            overridePriceEur: l.overridePriceEur ?? null,
          })),
          sellerId: draft.sellerId ?? null,
          depositEur: draft.depositEur ?? 0,
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

      await queryClient.invalidateQueries({ queryKey: ["agenda"] });
      await queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["home-dashboard"] });
      const final = totalFinalEur(draft);
      haptic("success");
      toast.success(`${t("appt.created")} · ${formatPrice(final)}`);
      for (const w of res.warnings) toast.warning(w);


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
      navigate({ to: "/agenda", search: created ? { novo: created } : {} });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
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