import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import "@/i18n";
import { useTranslation } from "react-i18next";

import { WizardStepper } from "@/components/appointment-wizard/stepper";
import { useArtists } from "@/hooks/use-artists";
import { allSessionsScheduled, useAppointmentDraft } from "@/stores/appointment-draft";
import { Button } from "@/components/ui/button";
import { WizardFrame } from "@/components/appointment-wizard/wizard-layout";

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
      allSessionsScheduled(draft),
    ),
    servicos: draft.services.length > 0,
    revisao: false,
  };
  return (
    <WizardFrame
      title={t("appt.title")}
      backLink={
        <Button asChild variant="outline" size="icon" className="rounded-xl">
          <Link to="/agenda" aria-label="Voltar para a agenda">
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </Link>
        </Button>
      }
      progress={<WizardStepper completed={completed} />}
    >
      <Outlet />
    </WizardFrame>
  );
}
