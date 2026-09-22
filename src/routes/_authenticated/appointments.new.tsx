import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import "@/i18n";
import { useTranslation } from "react-i18next";

import { WizardStepper } from "@/components/appointment-wizard/stepper";
import { useArtists } from "@/hooks/use-artists";
import { useAppointmentDraft } from "@/stores/appointment-draft";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/appointments/new")({
  component: WizardLayout,
});

function WizardLayout() {
  const { t } = useTranslation();
  const draft = useAppointmentDraft();
  const { data: artists = [] } = useArtists();
  const completed = {
    cliente: Boolean(draft.contact),
    projeto: draft.project?.decision !== null,
    agenda: Boolean(
      draft.calendarId &&
        artists.some((a) => a.calendarId === draft.calendarId) &&
        draft.startISO,
    ),
    servicos: draft.services.length > 0,
    revisao: false,
  };
  return (
    <div className="wizard-scope flex min-h-dvh flex-col bg-background pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 px-3 pb-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/agenda" aria-label="Voltar para a agenda">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <p className="text-xs font-semibold uppercase text-primary">Agendamento guiado</p>
            <h1 className="font-display text-lg font-bold">{t("appt.title")}</h1>
          </div>
        </div>
      </header>
      <WizardStepper completed={completed} />
      <Outlet />
    </div>
  );
}