import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import "@/i18n";
import { useArtists } from "@/hooks/use-artists";
import {
  useAppointmentDraft,
  balanceEur,
  draftValuesComplete,
  totalFinalEur,
  totalOriginalEur,
  allSessionsScheduled,
} from "@/stores/appointment-draft";
import { useFinalizeAppointment } from "@/hooks/use-finalize-appointment";
import { listSellers } from "@/lib/sellers.functions";
import { WizardReviewView } from "@/components/appointment-wizard/wizard-review-view";

export const Route = createFileRoute("/_authenticated/appointments/new/revisao")({
  head: () => ({
    meta: [
      { title: "Revisar — Novo agendamento" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: RevisaoStep,
});

function RevisaoStep() {
  const router = useRouter();
  const draft = useAppointmentDraft();
  const { data: artists = [] } = useArtists();
  const staff = artists.find((s) => s.calendarId === draft.calendarId) ?? null;
  const { run, saving } = useFinalizeAppointment();
  const fetchSellers = useServerFn(listSellers);
  const sellersQ = useQuery({
    queryKey: ["sellers", "active"],
    queryFn: () => fetchSellers({ data: {} }),
    staleTime: 5 * 60_000,
  });
  const sellers = sellersQ.data ?? [];
  const startLabel = useMemo(() => {
    if (!draft.startISO) return "—";
    return new Intl.DateTimeFormat("pt-PT", {
      timeZone: "Europe/Brussels",
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(draft.startISO));
  }, [draft.startISO]);

  const original = totalOriginalEur(draft);
  const final = totalFinalEur(draft);
  const hasDiscount = final < original;
  const deposit = Math.min(Math.max(0, draft.depositEur || 0), final);
  const balance = balanceEur(draft);
  const valuesComplete = draftValuesComplete(draft);
  const canFinalize = Boolean(
    !draft.bookingCheckpoint?.sessions.length &&
    draft.contact &&
    draft.calendarId &&
    staff &&
    draft.startISO &&
    draft.services.length > 0 &&
    valuesComplete &&
    (draft.depositEur || 0) <= final &&
    allSessionsScheduled(draft),
  );

  return (
    <WizardReviewView
      draft={draft}
      staffName={staff?.name ?? null}
      sellers={sellers}
      startLabel={startLabel}
      summary={{ original, final, hasDiscount, deposit, balance, valuesComplete }}
      canFinalize={canFinalize}
      saving={saving}
      onFinalize={() => {
        void run();
      }}
      onBack={() => router.history.back()}
    />
  );
}
