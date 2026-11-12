import { useState } from "react";
import { fromZonedTime } from "date-fns-tz";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgendaSessionPicker } from "@/components/appointment-wizard/agenda-session-picker";
import { WizardReviewView } from "@/components/appointment-wizard/wizard-review-view";
import { WizardFrame, WizardStepMain } from "@/components/appointment-wizard/wizard-layout";
import { WizardStepperView } from "@/components/appointment-wizard/stepper";
import { WizardFooterView } from "@/components/appointment-wizard/wizard-footer";
import { brusselsDayKey } from "@/lib/agenda-grid";
import { sessionStartForDay } from "@/lib/appointment-session-date";
import {
  allSessionsScheduled,
  balanceEur,
  draftValuesComplete,
  projectTotalEur,
  totalFinalEur,
  totalOriginalEur,
} from "@/stores/appointment-draft";
import type { AppointmentDraft } from "@/stores/appointment-draft";
import type { WizardStep } from "@/lib/appointment-draft-validate";

type Availability = "ready" | "loading" | "error" | "empty" | "no-calendar";
const INITIAL_STARTS = [
  "2026-11-16T10:00:00.000Z",
  "2026-11-23T13:00:00.000Z",
  "2026-12-07T10:00:00.000Z",
];
const formatEur = (value: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value);

function fixture(): AppointmentDraft {
  return {
    contact: {
      id: "fixture-contact",
      contactName: "Cliente de demonstração — cobertura em três sessões",
    },
    calendarId: "fixture-calendar",
    startISO: INITIAL_STARTS[0],
    services: [
      {
        service: {
          id: "fixture-service",
          name: "Sessão de cobertura — serviço fictício",
          category: "Demonstração",
          duration_min: 180,
          modality: "presencial",
          price_eur: 0,
          price_max_eur: null,
          description: null,
          description_short: "Valor por sessão",
          sort_order: 0,
          active: true,
          price_on_request: true,
        },
        discountPct: 0,
        overridePriceEur: 600,
      },
    ],
    notes: "Dados fictícios para revisão visual. Nenhum agendamento será criado.",
    sellerId: null,
    depositEur: 100,
    project: {
      decision: "new",
      reuseProjectId: null,
      reuseOpportunityId: null,
      projectType: "cover_up",
      bodyPart: "Antebraço — exemplo fictício",
      description:
        "Um único projeto fictício, com três sessões de igual valor em datas diferentes.",
    },
    idempotencyKey: "visual-fixture-not-persisted",
    sessionCount: 3,
    extraStarts: INITIAL_STARTS.slice(1),
  };
}

/** Synthetic state only. No route, server function, store hook or persistent write. */
export function BookingDemo() {
  const [draft, setDraft] = useState<AppointmentDraft>(fixture);
  const [step, setStep] = useState<"agenda" | "revisao">("agenda");
  const [availability, setAvailability] = useState<Availability>("ready");
  const [activeSession, setActiveSession] = useState(0);
  const [date, setDate] = useState(() => new Date(INITIAL_STARTS[0]));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const sessionStarts = [draft.startISO, ...draft.extraStarts];
  const dateLabel = new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Brussels",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
  const day = brusselsDayKey(date);
  const slots = Array.from({ length: 9 }, (_, i) =>
    fromZonedTime(`${day}T${String(i + 9).padStart(2, "0")}:00:00`, "Europe/Brussels").getTime(),
  );
  const calendarSelected = availability !== "no-calendar";
  const original = totalOriginalEur(draft);
  const final = totalFinalEur(draft);
  const valuesComplete = draftValuesComplete(draft);
  const canContinue = Boolean(calendarSelected && draft.startISO && allSessionsScheduled(draft));
  const canFinalize =
    canContinue && draft.services.length > 0 && valuesComplete && draft.depositEur <= final;
  const summary = {
    original,
    final,
    hasDiscount: final < original,
    deposit: Math.min(Math.max(0, draft.depositEur || 0), final),
    balance: balanceEur(draft),
    valuesComplete,
  };

  function setStart(iso: string | null) {
    setDraft((previous) =>
      activeSession === 0
        ? { ...previous, startISO: iso }
        : {
            ...previous,
            extraStarts: previous.extraStarts.map((value, i) =>
              i === activeSession - 1 ? iso : value,
            ),
          },
    );
  }
  function reset() {
    setDraft(fixture());
    setActiveSession(0);
    setDate(new Date(INITIAL_STARTS[0]));
    setStep("agenda");
    setAvailability("ready");
    setPickerOpen(false);
    setMessage("");
  }
  function navigateStep(next: WizardStep) {
    if (next === "agenda" || next === "revisao") {
      setStep(next);
      setMessage("");
    }
  }
  const reviewDraft = {
    ...draft,
    setSeller: (id: string | null) => setDraft((previous) => ({ ...previous, sellerId: id })),
    setOverridePrice: (id: string, eur: number | null) =>
      setDraft((previous) => ({
        ...previous,
        services: previous.services.map((line) =>
          line.service.id === id
            ? {
                ...line,
                overridePriceEur: eur == null || Number.isNaN(eur) ? null : Math.max(0, eur),
              }
            : line,
        ),
      })),
    setDiscount: (id: string, pct: number) =>
      setDraft((previous) => ({
        ...previous,
        services: previous.services.map((line) =>
          line.service.id === id ? { ...line, discountPct: Math.max(0, Math.min(100, pct)) } : line,
        ),
      })),
    removeService: (id: string) =>
      setDraft((previous) => ({
        ...previous,
        services: previous.services.filter((line) => line.service.id !== id),
      })),
    setNotes: (notes: string) =>
      setDraft((previous) => ({ ...previous, notes: notes.slice(0, 1000) })),
    setDeposit: (eur: number) =>
      setDraft((previous) => ({
        ...previous,
        depositEur: Number.isFinite(eur) ? Math.max(0, eur) : 0,
      })),
  };

  return (
    <>
      <aside className="border-b border-border bg-muted/50 px-4 py-4 text-sm">
        <div className="mx-auto max-w-4xl space-y-3">
          <p className="font-semibold">PRÉVIA VISUAL · Dados fictícios · Sem gravação</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Componentes reais dos passos Agenda e Revisão. Cliente, projeto e serviço já preenchidos
            somente para esta demonstração. Nenhuma chamada ao GHL ou finalização real.
          </p>
          <p className="text-xs text-muted-foreground">
            Um projeto: {valuesComplete ? formatEur(projectTotalEur(draft)) : "Valor não informado"}{" "}
            · {draft.sessionCount} sessões de{" "}
            {valuesComplete ? formatEur(final) : "valor a definir"}. O valor global do projeto não é
            somado às sessões.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-medium">
              Estado da disponibilidade (QA)
              <select
                className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"
                value={availability}
                onChange={(event) => setAvailability(event.target.value as Availability)}
              >
                <option value="ready">Horários disponíveis</option>
                <option value="loading">Carregando</option>
                <option value="error">Falha de leitura</option>
                <option value="empty">Sem horários</option>
                <option value="no-calendar">Sem tatuador selecionado</option>
              </select>
            </label>
            <Button type="button" variant="outline" onClick={reset}>
              <RotateCcw aria-hidden="true" />
              Reiniciar exemplo
            </Button>
          </div>
          <p
            role="status"
            aria-live="polite"
            className={
              message
                ? "fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-50 mx-auto max-w-xl rounded-xl border border-border bg-card p-4 text-sm font-medium shadow-lg"
                : "sr-only"
            }
          >
            {message}
          </p>
        </div>
      </aside>
      <WizardFrame
        title="Novo agendamento"
        backLink={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Voltar à agenda da demonstração"
            onClick={() => setStep("agenda")}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
        }
        progress={
          <WizardStepperView
            current={step}
            completed={{
              cliente: true,
              projeto: true,
              agenda: canContinue,
              servicos: true,
              revisao: false,
            }}
            renderLink={(next, content, className, active) =>
              next === "agenda" || next === "revisao" ? (
                <button
                  type="button"
                  className={className}
                  onClick={() => navigateStep(next)}
                  aria-current={active ? "step" : undefined}
                >
                  {content}
                </button>
              ) : (
                <span className={className} aria-disabled="true" title="Passo fora desta prévia">
                  {content}
                </span>
              )
            }
          />
        }
      >
        {step === "agenda" ? (
          <>
            <WizardStepMain
              title="Organize as sessões"
              description="Projeto fictício. Cada sessão mantém sua própria data e seu horário de Bruxelas."
            >
              <AgendaSessionPicker
                sessionCount={draft.sessionCount}
                sessionStarts={sessionStarts}
                activeSession={activeSession}
                onSessionCountChange={(count) => {
                  setDraft((previous) => ({
                    ...previous,
                    sessionCount: count,
                    extraStarts: Array.from(
                      { length: count - 1 },
                      (_, i) => previous.extraStarts[i] ?? null,
                    ),
                  }));
                  if (activeSession >= count) setActiveSession(0);
                }}
                onActiveSessionChange={(index) => {
                  setActiveSession(index);
                  const start = sessionStarts[index];
                  if (start) setDate(new Date(start));
                }}
                date={date}
                dateLabel={dateLabel}
                pickerOpen={pickerOpen}
                onPickerOpenChange={setPickerOpen}
                onDateChange={(nextDate) => {
                  setStart(sessionStartForDay(sessionStarts[activeSession], nextDate));
                  setDate(nextDate);
                  setPickerOpen(false);
                }}
                calendarSelected={calendarSelected}
                slots={availability === "empty" ? [] : slots}
                slotsLoading={availability === "loading"}
                slotsError={
                  availability === "error"
                    ? "Falha simulada — nenhuma consulta real foi executada."
                    : null
                }
                onRetry={() => setAvailability("ready")}
                onPickSlot={setStart}
              />
            </WizardStepMain>
            <WizardFooterView
              primary="Revisar sessões da demonstração"
              primaryDisabled={!canContinue}
              onPrimary={() => setStep("revisao")}
            />
          </>
        ) : (
          <WizardReviewView
            draft={reviewDraft}
            staffName={calendarSelected ? "Tatuador de demonstração" : null}
            sellers={[{ id: "fixture-seller", name: "Vendedor de demonstração", commissionPct: 0 }]}
            startLabel={
              draft.startISO
                ? new Intl.DateTimeFormat("pt-PT", {
                    timeZone: "Europe/Brussels",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(draft.startISO))
                : "—"
            }
            summary={summary}
            canFinalize={canFinalize}
            saving={false}
            onBack={() => setStep("agenda")}
            onFinalize={() =>
              setMessage(
                "Simulação — não salvo. Nenhum agendamento, oportunidade ou pagamento foi criado.",
              )
            }
          />
        )}
      </WizardFrame>
    </>
  );
}
