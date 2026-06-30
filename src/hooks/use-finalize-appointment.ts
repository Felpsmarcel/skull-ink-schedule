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
      });

      await queryClient.invalidateQueries({ queryKey: ["agenda"] });
      await queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      const final = totalFinalEur(draft);
      toast.success(`${t("appt.created")} · ${formatPrice(final)}`);
      if (res.warning) toast.warning(res.warning);
      draft.reset();
      navigate({ to: "/agenda" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return { run, saving };
}