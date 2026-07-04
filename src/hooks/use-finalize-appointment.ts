import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { LOCATION_ID } from "@/config/staff";
import { useArtists } from "@/hooks/use-artists";
import {
  useAppointmentDraft,
  totalDurationMin,
  totalFinalEur,
} from "@/stores/appointment-draft";
import { finalizeAppointment } from "@/lib/appointments";
import {
  validateAppointmentDraft,
  reasonToI18nKey,
} from "@/lib/appointment-draft-validate";
import { formatPrice } from "@/lib/services";
import { sendTransactionalEmail } from "@/lib/email/send";

export function useFinalizeAppointment() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draft = useAppointmentDraft();
  const { data: artists = [] } = useArtists();
  const [saving, setSaving] = useState(false);

  async function run() {
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

      const res = await finalizeAppointment({
        artistId: staff.id,
        calendarId: staff.calendarId,
        locationId: LOCATION_ID,
        contact,
        startISO,
        endISO,
        title,
        notes: notes || undefined,
        status: "confirmed",
        services,
        sellerId: draft.sellerId ?? null,
        depositEur: draft.depositEur ?? 0,
      });

      await queryClient.invalidateQueries({ queryKey: ["agenda"] });
      await queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      const final = totalFinalEur(draft);
      toast.success(`${t("appt.created")} · ${formatPrice(final)}`);
      if (res.warning) toast.warning(res.warning);

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

      draft.reset();
      navigate({ to: "/agenda" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const slotTaken = /slot.*(no longer|not).*available|no longer available/i.test(msg);
      if (slotTaken) {
        toast.error(t("appt.errors.slotTaken"));
        draft.setStart(null);
        navigate({ to: "/appointments/new" });
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return { run, saving };
}