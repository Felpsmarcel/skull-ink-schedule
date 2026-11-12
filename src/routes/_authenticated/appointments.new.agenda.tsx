import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import "@/i18n";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useArtists } from "@/hooks/use-artists";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  brusselsDayStartMs,
  brusselsDayEndMs,
  brusselsDayKey,
  extractFreeSlotStarts,
} from "@/lib/agenda-grid";
import { getFreeSlots } from "@/lib/ghl";
import { useAppointmentDraft } from "@/stores/appointment-draft";
import { WizardFooter } from "@/components/appointment-wizard/wizard-footer";
import { sessionStartForDay } from "@/lib/appointment-session-date";
import { AgendaSessionPicker } from "@/components/appointment-wizard/agenda-session-picker";
import { WizardStepMain, WizardSection } from "@/components/appointment-wizard/wizard-layout";

export const Route = createFileRoute("/_authenticated/appointments/new/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Novo agendamento" },
      {
        name: "description",
        content: "Selecione o tatuador, as datas e os horários das sessões no GF Tattoo Studio.",
      },
      { property: "og:title", content: "Novo agendamento — Agenda GF Tattoo" },
      {
        property: "og:description",
        content: "Seleção de datas e horários das sessões no GF Tattoo Studio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AgendaStep,
});

function AgendaStep() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const artistsQuery = useArtists();
  const allArtists = artistsQuery.data ?? [];
  const { data: me } = useCurrentUser();
  const artists =
    me?.role === "artist" && me.artistId
      ? allArtists.filter((a) => a.id === me.artistId)
      : allArtists;

  const draft = useAppointmentDraft();

  useEffect(() => {
    if (me?.role === "artist" && artists.length === 1) {
      const cal = artists[0]?.calendarId;
      if (!cal) return;
      if (draft.calendarId !== cal) draft.setCalendar(cal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.role, artists.length]);

  const [dateObj, setDateObj] = useState<Date>(() =>
    draft.startISO ? new Date(draft.startISO) : new Date(),
  );
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const dayKey = brusselsDayKey(dateObj);
  const dayStartMs = brusselsDayStartMs(dateObj);
  const dayEndMs = brusselsDayEndMs(dateObj);

  const slotsQuery = useQuery({
    enabled: Boolean(draft.calendarId),
    queryKey: ["appt-free-slots", draft.calendarId, dayKey],
    queryFn: async () => {
      if (!draft.calendarId) return [];
      const res = await getFreeSlots(draft.calendarId, dayStartMs, dayEndMs);
      if (!res.ok) throw new Error(`free-slots ${res.status}: ${JSON.stringify(res.data)}`);
      return extractFreeSlotStarts(res.data).sort((a, b) => a - b);
    },
    staleTime: 30_000,
  });

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-PT", {
        timeZone: "Europe/Brussels",
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(dateObj),
    [dateObj],
  );

  const [activeSession, setActiveSession] = useState(0);
  const sessionStart = (i: number) =>
    i === 0 ? draft.startISO : (draft.extraStarts[i - 1] ?? null);
  const pickSlot = (iso: string | null) => {
    if (activeSession === 0) draft.setStart(iso);
    else draft.setExtraStart(activeSession - 1, iso);
  };
  const canContinue = Boolean(
    draft.calendarId && draft.startISO && draft.extraStarts.every((v) => Boolean(v)),
  );
  const primary = !draft.calendarId
    ? t("appt.cta.selectStaff")
    : !draft.startISO
      ? t("appt.cta.selectTime")
      : t("appt.wizard.next");

  return (
    <>
      <WizardStepMain
        title="Organize as sessões"
        description="Escolha o tatuador e reserve uma data para cada etapa do projeto."
      >
        <WizardSection>
          <Label htmlFor="wizard-artist" className="mb-3 block text-sm font-semibold">
            {t("appt.staff")}
          </Label>
          <Select value={draft.calendarId ?? undefined} onValueChange={draft.setCalendar}>
            <SelectTrigger id="wizard-artist" className="h-12 rounded-xl">
              <SelectValue placeholder={t("appt.staffPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {artists.map((s) => (
                <SelectItem key={s.id} value={s.calendarId} className="min-h-11">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Ao trocar o tatuador, escolha novamente as datas e os horários de todas as sessões.
          </p>
        </WizardSection>
        <AgendaSessionPicker
          sessionCount={draft.sessionCount}
          sessionStarts={Array.from({ length: draft.sessionCount }, (_, i) => sessionStart(i))}
          activeSession={activeSession}
          onSessionCountChange={(n) => {
            draft.setSessionCount(n);
            if (activeSession >= n) setActiveSession(0);
          }}
          onActiveSessionChange={(i) => {
            setActiveSession(i);
            const start = sessionStart(i);
            if (start) setDateObj(new Date(start));
          }}
          date={dateObj}
          dateLabel={dateLabel}
          pickerOpen={datePickerOpen}
          onPickerOpenChange={setDatePickerOpen}
          onDateChange={(d) => {
            pickSlot(sessionStartForDay(sessionStart(activeSession), d));
            setDateObj(d);
            setDatePickerOpen(false);
          }}
          calendarSelected={Boolean(draft.calendarId)}
          slots={slotsQuery.data ?? []}
          slotsLoading={slotsQuery.isLoading}
          slotsError={slotsQuery.error ? (slotsQuery.error as Error).message : null}
          onRetry={() => {
            void slotsQuery.refetch();
          }}
          onPickSlot={pickSlot}
        />
      </WizardStepMain>
      <WizardFooter
        showBack
        primary={primary}
        primaryDisabled={!canContinue}
        onPrimary={() => navigate({ to: "/appointments/new/servicos" })}
      />
    </>
  );
}
