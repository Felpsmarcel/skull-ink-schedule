import { useTranslation } from "react-i18next";
import { Loader2, Mail, Phone, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROJECT_TYPE_LABELS } from "@/lib/linking";
import { cn } from "@/lib/utils";
import { formatPrice, modalityLabel } from "@/lib/services";
import { linePriceEur, projectTotalEur } from "@/stores/appointment-draft";
import type { AppointmentDraft } from "@/stores/appointment-draft";
import type { Seller } from "@/lib/sellers.functions";
import { WizardFooterView } from "./wizard-footer";
import { WizardStepMain, WizardSection } from "./wizard-layout";

export type WizardReviewDraft = AppointmentDraft & {
  setSeller: (id: string | null) => void;
  setOverridePrice: (serviceId: string, eur: number | null) => void;
  setDiscount: (serviceId: string, pct: number) => void;
  removeService: (serviceId: string) => void;
  setNotes: (notes: string) => void;
  setDeposit: (eur: number) => void;
};
export interface WizardReviewViewProps {
  draft: WizardReviewDraft;
  staffName: string | null;
  sellers: Pick<Seller, "id" | "name" | "commissionPct">[];
  startLabel: string;
  summary: {
    original: number;
    final: number;
    hasDiscount: boolean;
    deposit: number;
    balance: number;
    valuesComplete: boolean;
  };
  canFinalize: boolean;
  saving: boolean;
  onFinalize: () => void;
  onBack?: () => void;
}

/** Controlled review. Only the route can finalize an appointment. */
export function WizardReviewView({
  draft,
  staffName,
  sellers,
  startLabel,
  summary,
  canFinalize,
  saving,
  onFinalize,
  onBack,
}: WizardReviewViewProps) {
  const { t } = useTranslation();
  const { original, final, hasDiscount, deposit, balance, valuesComplete } = summary;
  return (
    <>
      <WizardStepMain
        title="Revise o agendamento"
        description="Confira o cliente, as sessões e os valores antes de finalizar o agendamento."
      >
        {draft.bookingCheckpoint?.sessions.length ? (
          <div
            role="alert"
            className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
          >
            <h3 className="font-semibold">Finalização precisa de revisão administrativa</h3>
            <p>{draft.bookingCheckpoint.reason}</p>
            <p>
              Não reinicie o cadastro para repetir estas sessões. Confira os registros confirmados e
              a sessão pendente antes de qualquer lançamento adicional.
            </p>
            <ul className="space-y-2 break-words text-xs">
              {draft.bookingCheckpoint.sessions.map((session) => (
                <li key={session.idempotencyKey}>
                  Sessão {session.session}: agendamento{" "}
                  <span className="break-all font-mono">{session.appointmentId}</span>
                  {session.ghlEventId ? (
                    <>
                      {" "}
                      · Evento GHL <span className="break-all font-mono">{session.ghlEventId}</span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            {draft.bookingCheckpoint.pendingSession ? (
              <p>Sessão pendente de conferência: {draft.bookingCheckpoint.pendingSession}.</p>
            ) : null}
          </div>
        ) : null}
        <WizardSection className="flex flex-wrap items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-muted text-base font-semibold text-foreground">
            {(draft.contact?.contactName ?? draft.contact?.firstName ?? "?")
              .slice(0, 1)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="break-words text-sm font-semibold">
              {draft.contact?.contactName ??
                [draft.contact?.firstName, draft.contact?.lastName].filter(Boolean).join(" ") ??
                t("appt.noClient")}
            </div>
            <div className="break-all text-xs text-muted-foreground">
              {draft.contact?.phone ?? draft.contact?.email ?? ""}
            </div>
          </div>
          <div className="flex gap-1">
            <a
              href={draft.contact?.phone ? `tel:${draft.contact.phone}` : undefined}
              aria-disabled={!draft.contact?.phone}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                draft.contact?.phone
                  ? "text-foreground hover:bg-muted"
                  : "pointer-events-none text-muted-foreground/40",
              )}
              aria-label="Ligar"
            >
              <Phone className="h-4 w-4" />
            </a>
            <a
              href={draft.contact?.email ? `mailto:${draft.contact.email}` : undefined}
              aria-disabled={!draft.contact?.email}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                draft.contact?.email
                  ? "text-foreground hover:bg-muted"
                  : "pointer-events-none text-muted-foreground/40",
              )}
              aria-label="E-mail"
            >
              <Mail className="h-4 w-4" />
            </a>
          </div>
        </WizardSection>

        <WizardSection className="space-y-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <span className="text-muted-foreground">{t("appt.dateTime")}</span>
            <span className="break-words font-medium">{startLabel}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <span className="text-muted-foreground">{t("appt.staff")}</span>
            <span className="break-words font-medium">{staffName ?? "—"}</span>
          </div>
          <div className="mt-2">
            <Label htmlFor="wizard-seller" className="text-sm text-muted-foreground">
              Vendedor
            </Label>
            <Select
              value={draft.sellerId ?? "none"}
              onValueChange={(v) => draft.setSeller(v === "none" ? null : v)}
            >
              <SelectTrigger id="wizard-seller" className="mt-2 h-12 rounded-xl text-sm">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {sellers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.commissionPct > 0 ? ` (${s.commissionPct}%)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </WizardSection>

        <WizardSection className="space-y-3 text-sm">
          <h3 className="mb-3 text-sm font-semibold">Projeto e oportunidade</h3>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <span className="text-muted-foreground">Decisão</span>
            <span className="break-words font-medium">
              {draft.project.decision === "reuse"
                ? "Usar oportunidade/projeto existente"
                : draft.project.decision === "new"
                  ? "Criar novo projeto"
                  : "—"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <span className="text-muted-foreground">Tipo</span>
            <span className="break-words font-medium">
              {PROJECT_TYPE_LABELS[draft.project.projectType]}
            </span>
          </div>
          {draft.project.bodyPart ? (
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <span className="text-muted-foreground">Local do corpo</span>
              <span className="break-words font-medium">{draft.project.bodyPart}</span>
            </div>
          ) : null}
          {draft.project.description ? (
            <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
              {draft.project.description}
            </p>
          ) : null}
          {draft.project.reuseOpportunityId ? (
            <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
              Oportunidade: {draft.project.reuseOpportunityId}
            </p>
          ) : null}
        </WizardSection>

        <WizardSection>
          <h3 className="mb-3 text-sm font-semibold">{t("appt.services")}</h3>
          {draft.services.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("appt.noServices")}</p>
          ) : (
            <ul className="space-y-2">
              {draft.services.map((l) => {
                const base = linePriceEur(l);
                const lineFinal = base * (1 - l.discountPct / 100);
                const hasDisc = l.discountPct > 0;
                const onRequest = l.service.price_on_request;
                return (
                  <li
                    key={l.service.id}
                    className="rounded-xl border border-border bg-background p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 basis-40">
                        <div className="break-words text-sm font-medium">{l.service.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.service.duration_min} min · {modalityLabel(l.service.modality)}
                        </div>
                      </div>
                      <div className="text-right">
                        {hasDisc && base > 0 ? (
                          <div className="text-xs text-muted-foreground line-through">
                            {formatPrice(base)}
                          </div>
                        ) : null}
                        <div className="text-sm font-semibold">
                          {onRequest && !(base > 0)
                            ? "Valor não informado"
                            : formatPrice(lineFinal)}
                        </div>
                      </div>
                    </div>
                    {onRequest ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Label
                          htmlFor={`wizard-price-${l.service.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          Valor (€)
                        </Label>
                        <Input
                          id={`wizard-price-${l.service.id}`}
                          inputMode="decimal"
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.overridePriceEur ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            draft.setOverridePrice(l.service.id, v === "" ? null : Number(v));
                          }}
                          placeholder="0,00"
                          className="h-11 w-28 rounded-lg text-sm"
                        />
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Label
                        htmlFor={`wizard-discount-${l.service.id}`}
                        className="text-xs text-muted-foreground"
                      >
                        {t("appt.discount")} %
                      </Label>
                      <Input
                        id={`wizard-discount-${l.service.id}`}
                        inputMode="decimal"
                        type="number"
                        min={0}
                        max={100}
                        value={l.discountPct}
                        onChange={(e) =>
                          draft.setDiscount(l.service.id, Number(e.target.value) || 0)
                        }
                        className="h-11 w-20 rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => draft.removeService(l.service.id)}
                        className="ml-auto grid h-11 w-11 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`${t("appt.removeService")}: ${l.service.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </WizardSection>

        <WizardSection>
          <Label htmlFor="notes" className="mb-3 block text-sm font-semibold">
            {t("appt.notes")}
          </Label>
          <Textarea
            id="notes"
            className="rounded-xl"
            rows={4}
            value={draft.notes}
            onChange={(e) => draft.setNotes(e.target.value)}
            placeholder={t("appt.notesPlaceholder")}
          />
        </WizardSection>

        <WizardSection className="space-y-4 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <span className="text-muted-foreground">
              {draft.sessionCount > 1 ? "Total por sessão" : t("appt.total")}
            </span>
            <div className="text-right">
              {valuesComplete && hasDiscount ? (
                <div className="text-xs text-muted-foreground line-through">
                  {formatPrice(original)}
                </div>
              ) : null}
              <div className="text-lg font-bold">
                {valuesComplete ? formatPrice(final) : "Valor não informado"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 gap-3">
            <Label htmlFor="deposit" className="text-muted-foreground">
              Sinal informado (€)
            </Label>
            <Input
              id="deposit"
              aria-describedby="wizard-deposit-help"
              inputMode="decimal"
              type="number"
              min={0}
              step="0.01"
              value={draft.depositEur || ""}
              onChange={(e) => {
                const v = e.target.value;
                draft.setDeposit(v === "" ? 0 : Number(v));
              }}
              placeholder="0,00"
              className="h-11 w-32 rounded-lg text-right text-sm tabular-nums"
            />
          </div>
          <p id="wizard-deposit-help" className="text-xs leading-5 text-muted-foreground">
            Valor declarado como recebido. A confirmação solicita o registro do sinal como
            pagamento; o comprovante não é verificado nesta tela.
          </p>

          {draft.sessionCount > 1 ? (
            <div className="space-y-1 border-t border-border pt-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <span className="font-semibold">
                  Total do projeto · {draft.sessionCount} sessões
                </span>
                <span className="text-lg font-bold">
                  {valuesComplete ? formatPrice(projectTotalEur(draft)) : "Valor não informado"}
                </span>
              </div>
              {Array.from({ length: draft.sessionCount }, (_, i) => {
                const iso = i === 0 ? draft.startISO : draft.extraStarts[i - 1];
                return (
                  <div
                    key={i}
                    className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-1 text-xs leading-5 text-muted-foreground"
                  >
                    <span>
                      Sessão {i + 1}/{draft.sessionCount} ·{" "}
                      {iso
                        ? new Intl.DateTimeFormat("pt-PT", {
                            timeZone: "Europe/Brussels",
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(iso))
                        : "sem data"}
                    </span>
                    <span>
                      {valuesComplete ? formatPrice(final) : "A definir"}
                      {i === 0 && deposit > 0 ? ` (sinal ${formatPrice(deposit)})` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          {deposit > 0 ? (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t border-border pt-2">
              <span className="font-semibold">
                {draft.sessionCount > 1 ? "Saldo da sessão 1" : "Saldo restante"}
              </span>
              <span className="text-lg font-bold">
                {valuesComplete ? formatPrice(balance) : "A definir"}
              </span>
            </div>
          ) : null}

          {valuesComplete && draft.depositEur > final && final > 0 ? (
            <p role="alert" className="text-xs text-destructive">
              O sinal não pode ser maior que o total.
            </p>
          ) : null}
          {!valuesComplete ? (
            <p role="alert" className="text-xs text-destructive">
              Informe o valor dos serviços marcados como “sob consulta”.
            </p>
          ) : null}
        </WizardSection>
      </WizardStepMain>
      <WizardFooterView
        onBack={onBack}
        primary={
          <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {draft.sessionCount > 1
              ? `Confirmar ${draft.sessionCount} sessões`
              : t("appt.finalize")}
            <span className="text-xs opacity-80">
              ·{" "}
              {valuesComplete
                ? formatPrice(draft.sessionCount > 1 ? projectTotalEur(draft) : final)
                : "Valor não informado"}
            </span>
          </span>
        }
        primaryDisabled={!canFinalize}
        primaryLoading={saving}
        onPrimary={onFinalize}
      />
    </>
  );
}
