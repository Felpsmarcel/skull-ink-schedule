import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon } from "lucide-react";
import "@/i18n";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { useArtists } from "@/hooks/use-artists";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  brusselsDayStartMs,
  brusselsDayEndMs,
  brusselsDayKey,
  extractFreeSlotStarts,
  formatHHmm,
} from "@/lib/agenda-grid";
import { getFreeSlots } from "@/lib/ghl";
import { useAppointmentDraft } from "@/stores/appointment-draft";
import { WizardFooter } from "@/components/appointment-wizard/wizard-footer";

export const Route = createFileRoute("/_authenticated/appointments/new/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Novo agendamento" },
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
      const cal = artists[0]!.calendarId;
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
      const res = await getFreeSlots(draft.calendarId!, dayStartMs, dayEndMs);
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

  const canContinue = Boolean(draft.calendarId && draft.startISO);
  const primary = !draft.calendarId
    ? t("appt.cta.selectStaff")
    : !draft.startISO
      ? t("appt.cta.selectTime")
      : t("appt.wizard.next");

  return (
    <>
      <main className="flex-1 space-y-4 p-4 pb-0">
        <section className="rounded-lg border border-border bg-card p-3">
          <Label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("appt.staff")}
          </Label>
          <Select
            value={draft.calendarId ?? undefined}
            onValueChange={(v) => {
              draft.setCalendar(v);
              draft.setStart(null);
            }}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder={t("appt.staffPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {artists.map((s) => (
                <SelectItem key={s.id} value={s.calendarId}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        <section className="rounded-lg border border-border bg-card p-3">
          <Label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("appt.dateTime")}
          </Label>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-11 w-full justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateObj}
                onSelect={(d) => {
                  if (d) {
                    setDateObj(d);
                    draft.setStart(null);
                    setDatePickerOpen(false);
                  }
                }}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <div className="mt-3">
            {!draft.calendarId ? (
              <p className="text-xs text-muted-foreground">{t("appt.pickStaffFirst")}</p>
            ) : slotsQuery.isLoading ? (
              <LoadingState inline size="sm" label={t("appt.loadingSlots")} />
            ) : slotsQuery.error ? (
              <ErrorState
                description="Não foi possível carregar os horários."
                details={(slotsQuery.error as Error).message}
                onRetry={() => slotsQuery.refetch()}
              />
            ) : (slotsQuery.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("appt.noSlots")}</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {(slotsQuery.data ?? []).map((ms) => {
                  const iso = new Date(ms).toISOString();
                  const active = draft.startISO === iso;
                  return (
                    <button
                      type="button"
                      key={ms}
                      onClick={() => draft.setStart(iso)}
                      className={cn(
                        "h-11 rounded border px-2 text-sm font-medium",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:border-primary/60",
                      )}
                    >
                      {formatHHmm(ms)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
      <WizardFooter
        showBack
        primary={primary}
        primaryDisabled={!canContinue}
        onPrimary={() => navigate({ to: "/appointments/new/servicos" })}
      />
    </>
  );
}