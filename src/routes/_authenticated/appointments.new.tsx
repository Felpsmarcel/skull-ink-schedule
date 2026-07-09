import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import "@/i18n";
import { useTranslation } from "react-i18next";

import { WizardStepper } from "@/components/appointment-wizard/stepper";
import { useArtists } from "@/hooks/use-artists";
import { useAppointmentDraft } from "@/stores/appointment-draft";

export const Route = createFileRoute("/_authenticated/appointments/new")({
  component: WizardLayout,
});

function WizardLayout() {
  const { t } = useTranslation();
  const draft = useAppointmentDraft();
  const { data: artists = [] } = useArtists();
  const completed = {
    cliente: Boolean(draft.contact),
    agenda: Boolean(
      draft.calendarId &&
        artists.some((a) => a.calendarId === draft.calendarId) &&
        draft.startISO,
    ),
    servicos: draft.services.length > 0,
    revisao: false,
  };
  return (
    <div className="flex min-h-dvh flex-col bg-background pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <Link
          to="/agenda"
          className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
          aria-label="Voltar para a agenda"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-lg uppercase tracking-wide">{t("appt.title")}</h1>
      </header>
      <WizardStepper completed={completed} />
      <Outlet />
    </div>
  );
}