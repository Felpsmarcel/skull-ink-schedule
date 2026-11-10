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

  const [activeSession, setActiveSession] = useState(0);
  const sessionStart = (i: number) => (i === 0 ? draft.startISO : draft.extraStarts[i - 1] ?? null);
  const pickSlot = (iso: string) => {
    if (activeSession === 0) draft.setStart(iso);
    else draft.setExtraStart(activeSession - 1, iso);
  };
  const fmtSession = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat("pt-PT", {
          timeZone: "Europe/Brussels",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(iso))
      : "Escolher data";
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
            Sessões do projeto
          </Label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => {
                  draft.setSessionCount(n);
                  if (activeSession >= n) setActiveSession(0);
                }}
                className={cn(
                  "h-9 min-w-9 rounded border px-3 text-sm font-medium",
                  draft.sessionCount === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/60",
                )}
              >
                {n === 1 ? "Sessão única" : n}
              </button>
            ))}
          </div>
          {draft.sessionCount > 1 ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Escolha a data de cada sessão. Todas usam os mesmos serviços e valor; o projeto
                entra uma única vez no financeiro pelo valor total.
              </p>
              {Array.from({ length: draft.sessionCount }, (_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setActiveSession(i)}
                  className={cn(
                    "flex h-11 w-full items-center justify-between rounded border px-3 text-sm",
                    activeSession === i
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background",
                  )}
                >
                  <span className="font-medium">
                    Sessão {i + 1}/{draft.sessionCount}
                  </span>
                  <span className={sessionStart(i) ? "" : "text-muted-foreground"}>
                    {fmtSession(sessionStart(i))}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-border bg-card p-3">
          <Label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("appt.dateTime")}
            {draft.sessionCount > 1 ? ` · Sessão ${activeSession + 1}` : ""}
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
                  const active = sessionStart(activeSession) === iso;
                  const usedElsewhere = Array.from({ length: draft.sessionCount }, (_, i) =>
                    sessionStart(i),
                  ).some((v, i) => i !== activeSession && v === iso);
                  return (
                    <button
                      type="button"
                      key={ms}
                      disabled={usedElsewhere}
                      onClick={() => pickSlot(iso)}
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