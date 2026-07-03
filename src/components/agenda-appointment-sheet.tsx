import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Copy,
  Phone,
  Mail,
  AlertTriangle,
  ExternalLink,
  Euro,
  Wallet,
  Plus,
  Loader2,
  Lock,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { StatusBadge, bucketToVariant, bucketLabel } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { getContact } from "@/lib/ghl";
import type { PaymentBucket } from "@/lib/finance.functions";
import type { GridSlot } from "@/lib/agenda-grid";
import { resolveIntlLocale } from "@/lib/locale";
import {
  getAppointmentFinanceByGhlId,
  upsertAppointmentFinance,
  registerAppointmentPayment,
  setAppointmentPaymentStatus,
  type AppointmentFinanceView,
} from "@/lib/appointments.functions";
import { listAllServices } from "@/lib/services.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: GridSlot | null;
  staffName: string;
  calendarId: string;
  bucket?: PaymentBucket;
  debug?: boolean;
}

export function AgendaAppointmentSheet({
  open,
  onOpenChange,
  slot,
  staffName,
  calendarId,
  bucket,
  debug,
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = resolveIntlLocale(i18n.language);

  const contactId = slot?.contactId ?? null;

  const contactQ = useQuery({
    queryKey: ["ghl-contact", contactId],
    enabled: Boolean(open && contactId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await getContact(contactId!);
      if (!r.ok) throw new Error(`GHL ${r.status}`);
      return r.data.contact ?? null;
    },
  });

  const startMs = slot?.eventStartMs ?? slot?.startMs;
  const endMs = slot?.eventEndMs;
  const durationMin =
    startMs != null && endMs != null ? Math.max(0, Math.round((endMs - startMs) / 60000)) : 0;

  const whenLine = startMs
    ? formatWhen(locale, startMs, endMs ?? startMs)
    : "";
  const durationLine = durationMin > 0 ? formatDuration(durationMin) : "";

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("agenda.details.copied"));
    } catch {
      toast.error(t("common.error.title"));
    }
  };

  const contact = contactQ.data ?? null;
  const fallbackName = slot?.contactName ?? t("agenda.booked");
  const displayName =
    contact?.contactName ||
    [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") ||
    fallbackName;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="text-left">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="truncate font-display text-lg uppercase tracking-wide">
              {displayName}
            </SheetTitle>
            {bucket ? (
              <StatusBadge variant={bucketToVariant(bucket)} className="shrink-0">
                {bucketLabel(bucket)}
              </StatusBadge>
            ) : null}
          </div>
          <SheetDescription className="text-xs">
            {whenLine}
            {durationLine ? ` · ${durationLine}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5 overflow-y-auto pb-6 text-sm">
          {slot?.hasOverlap ? (
            <div className="flex items-start gap-2 rounded border border-border bg-muted p-2 text-[12px] text-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{t("agenda.details.overlap")}</span>
            </div>
          ) : null}

          <Row label={t("agenda.details.artist")} value={staffName} />
          <Row
            label={t("agenda.details.service")}
            value={slot?.serviceName || t("agenda.booked")}
          />
          {slot?.appointmentStatus ? (
            <Row label={t("agenda.details.status")} value={slot.appointmentStatus} />
          ) : null}

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("agenda.details.contact")}
            </div>
            {!contactId ? (
              <p className="text-xs text-muted-foreground">{t("agenda.details.noContact")}</p>
            ) : contactQ.isLoading ? (
              <LoadingState inline size="sm" />
            ) : contactQ.error ? (
              <ErrorState
                description={t("agenda.details.contactError")}
                details={(contactQ.error as Error).message}
                onRetry={() => contactQ.refetch()}
              />
            ) : (
              <div className="space-y-2">
                <ContactLine
                  icon={<Phone className="h-3.5 w-3.5" />}
                  value={contact?.phone ?? null}
                  href={contact?.phone ? `tel:${contact.phone}` : undefined}
                  actionLabel={t("agenda.details.call")}
                  emptyLabel="—"
                  onCopy={copy}
                />
                <ContactLine
                  icon={<Mail className="h-3.5 w-3.5" />}
                  value={contact?.email ?? null}
                  href={contact?.email ? `mailto:${contact.email}` : undefined}
                  actionLabel={t("agenda.details.sendEmail")}
                  emptyLabel="—"
                  onCopy={copy}
                />
              </div>
            )}
          </div>

          {slot?.ghlEventId ? (
            <FinanceSection ghlEventId={slot.ghlEventId} locale={locale} />
          ) : null}

          {debug ? (
            <details className="rounded border border-border/60 bg-muted/40 p-2 text-[10px]">
              <summary className="cursor-pointer font-semibold">debug</summary>
              <div className="mt-1 space-y-0.5 font-mono">
                <div>event: {slot?.ghlEventId ?? "—"}</div>
                <div>calendar: {calendarId}</div>
                <div>contact: {contactId ?? "—"}</div>
                <div>span: {slot?.spanSlots ?? "?"} slots</div>
              </div>
            </details>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ============================ Finance ============================ */

function currency(locale: string, n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(n));
}

function FinanceSection({
  ghlEventId,
  locale,
}: {
  ghlEventId: string;
  locale: string;
}) {
  const queryClient = useQueryClient();
  const fetchFinance = useServerFn(getAppointmentFinanceByGhlId);

  const financeQ = useQuery<AppointmentFinanceView>({
    queryKey: ["appointment-finance", ghlEventId],
    queryFn: () => fetchFinance({ data: { ghlEventId } }),
    staleTime: 30_000,
  });

  const [showValueForm, setShowValueForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["appointment-finance", ghlEventId] });
    queryClient.invalidateQueries({ queryKey: ["finance"] });
    queryClient.invalidateQueries({ queryKey: ["agenda-status"] });
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Euro className="h-3 w-3" /> Financeiro
      </div>

      {financeQ.isLoading ? (
        <LoadingState inline size="sm" />
      ) : financeQ.error ? (
        <ErrorState
          description="Não foi possível carregar dados financeiros."
          details={(financeQ.error as Error).message}
          onRetry={() => financeQ.refetch()}
        />
      ) : !financeQ.data?.appointmentId ? (
        <p className="rounded border border-dashed border-border p-2 text-[11px] text-muted-foreground">
          Agendamento ainda não sincronizado no banco. Os valores aparecerão após a
          próxima sincronização.
        </p>
      ) : !financeQ.data.visible ? (
        <p className="rounded border border-dashed border-border p-2 text-[11px] text-muted-foreground">
          Valores financeiros visíveis apenas para o tatuador responsável e para
          admin.
        </p>
      ) : (
        <FinanceBody
          data={financeQ.data}
          locale={locale}
          onEdit={() => setShowValueForm((v) => !v)}
          onPay={() => setShowPaymentForm((v) => !v)}
          editing={showValueForm}
          paying={showPaymentForm}
        />
      )}

      {financeQ.data?.visible && financeQ.data.appointmentId && showValueForm ? (
        <ValueForm
          ghlEventId={ghlEventId}
          initial={financeQ.data}
          onSaved={() => {
            setShowValueForm(false);
            invalidateAll();
          }}
          onCancel={() => setShowValueForm(false)}
        />
      ) : null}

      {financeQ.data?.visible && financeQ.data.appointmentId && showPaymentForm ? (
        <PaymentForm
          ghlEventId={ghlEventId}
          suggestedAmount={financeQ.data.balanceEur ?? 0}
          onSaved={() => {
            setShowPaymentForm(false);
            invalidateAll();
          }}
          onCancel={() => setShowPaymentForm(false)}
        />
      ) : null}
    </div>
  );
}

function FinanceBody({
  data,
  locale,
  onEdit,
  onPay,
  editing,
  paying,
  ghlEventId,
  onOverrideChanged,
}: {
  data: AppointmentFinanceView;
  locale: string;
  onEdit: () => void;
  onPay: () => void;
  editing: boolean;
  paying: boolean;
  ghlEventId: string;
  onOverrideChanged: () => void;
}) {
  return (
    <div className="space-y-3">
      <PaymentStatusPicker
        ghlEventId={ghlEventId}
        current={data.manualPaymentStatus}
        onChanged={onOverrideChanged}
      />

      <div className="grid grid-cols-2 gap-2 rounded border border-border bg-muted/30 p-2 text-xs">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Total
          </div>
          <div className="text-sm font-semibold tabular-nums">
            {currency(locale, data.totalEur)}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Recebido
          </div>
          <div className="text-sm font-semibold tabular-nums">
            {currency(locale, data.paidTotalEur)}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Saldo
          </div>
          <div className="text-sm font-semibold tabular-nums">
            {currency(locale, data.balanceEur)}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Comissão ({data.commissionPct ?? "—"}%)
          </div>
          <div className="text-sm font-semibold tabular-nums">
            {currency(locale, data.commissionEur)}
          </div>
        </div>
      </div>

      {data.services.length > 0 ? (
        <div className="space-y-1">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Serviços
          </div>
          {data.services.map((s) => (
            <div
              key={s.service_id}
              className="flex items-center justify-between text-[11px]"
            >
              <span className="min-w-0 flex-1 truncate">
                {s.quantity > 1 ? `${s.quantity}× ` : ""}
                {s.name}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {currency(locale, s.price_eur * s.quantity)}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {data.payments.length > 0 ? (
        <div className="space-y-1">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Pagamentos
          </div>
          {data.payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between text-[11px]"
            >
              <span className="min-w-0 flex-1 truncate">
                {p.type === "deposit"
                  ? "Sinal"
                  : p.type === "final"
                    ? "Final"
                    : "Reembolso"}{" "}
                · {p.method}
                {p.paid_at
                  ? ` · ${new Date(p.paid_at).toLocaleDateString(locale)}`
                  : ""}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {p.type === "refund" ? "-" : ""}
                {currency(locale, p.amount_eur)}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-[11px]"
          onClick={onEdit}
        >
          <Euro className="mr-1 h-3 w-3" />
          {data.totalEur == null ? "Registrar valor" : editing ? "Fechar" : "Editar valor"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-[11px]"
          onClick={onPay}
          disabled={data.totalEur == null && !paying}
        >
          <Wallet className="mr-1 h-3 w-3" />
          {paying ? "Fechar" : "Registrar pagamento"}
        </Button>
      </div>
    </div>
  );
}

function ValueForm({
  ghlEventId,
  initial,
  onSaved,
  onCancel,
}: {
  ghlEventId: string;
  initial: AppointmentFinanceView;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const upsert = useServerFn(upsertAppointmentFinance);
  const listSvc = useServerFn(listAllServices);
  const svcQ = useQuery({
    queryKey: ["services-active-for-agenda"],
    queryFn: () => listSvc(),
    staleTime: 5 * 60_000,
  });

  const [totalStr, setTotalStr] = useState(
    initial.totalEur != null ? String(initial.totalEur) : "",
  );
  const [discountStr, setDiscountStr] = useState(
    initial.discountEur != null && initial.discountEur > 0
      ? String(initial.discountEur)
      : "",
  );
  const [pctStr, setPctStr] = useState(
    initial.commissionPct != null ? String(initial.commissionPct) : "",
  );
  const [lines, setLines] = useState<Array<{ serviceId: string; quantity: number }>>(
    initial.services.map((s) => ({ serviceId: s.service_id, quantity: s.quantity })),
  );

  const mutation = useMutation({
    mutationFn: (payload: {
      ghlEventId: string;
      totalEur: number | null;
      discountEur: number;
      commissionPct: number | null;
      services: Array<{ serviceId: string; quantity: number }>;
    }) => upsert({ data: payload }),
    onSuccess: () => {
      toast.success("Valor salvo.");
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addLine = () => setLines((ls) => [...ls, { serviceId: "", quantity: 1 }]);
  const removeLine = (i: number) =>
    setLines((ls) => ls.filter((_, idx) => idx !== i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const total = totalStr.trim() ? Number(totalStr) : null;
    const discount = discountStr.trim() ? Number(discountStr) : 0;
    const pct = pctStr.trim() ? Number(pctStr) : null;
    const cleanLines = lines.filter((l) => l.serviceId);
    if (total == null && cleanLines.length === 0) {
      toast.error("Informe um total ou selecione ao menos 1 serviço.");
      return;
    }
    mutation.mutate({
      ghlEventId,
      totalEur: total,
      discountEur: discount,
      commissionPct: pct,
      services: cleanLines,
    });
  };

  const services = svcQ.data ?? [];

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-3 rounded border border-border p-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px]">Total (€)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={totalStr}
            onChange={(e) => setTotalStr(e.target.value)}
            placeholder="livre"
          />
        </div>
        <div>
          <Label className="text-[10px]">Desconto (€)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={discountStr}
            onChange={(e) => setDiscountStr(e.target.value)}
          />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px]">Comissão (%)</Label>
          <Input
            type="number"
            step="1"
            min="0"
            max="100"
            inputMode="numeric"
            value={pctStr}
            onChange={(e) => setPctStr(e.target.value)}
            placeholder="padrão do artista"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px]">Serviços (opcional)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={addLine}
          >
            <Plus className="mr-1 h-3 w-3" /> Adicionar
          </Button>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="flex items-center gap-1">
            <Select
              value={l.serviceId}
              onValueChange={(v) =>
                setLines((ls) =>
                  ls.map((x, idx) => (idx === i ? { ...x, serviceId: v } : x)),
                )
              }
            >
              <SelectTrigger className="h-8 flex-1 text-[11px]">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {services
                  .filter((s) => s.active)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-[11px]">
                      {s.name} · €{Number(s.price_eur)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              max={20}
              value={l.quantity}
              onChange={(e) =>
                setLines((ls) =>
                  ls.map((x, idx) =>
                    idx === i
                      ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) }
                      : x,
                  ),
                )
              }
              className="h-8 w-14 text-[11px]"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-[11px]"
              onClick={() => removeLine(i)}
            >
              ×
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-[11px]"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          className="h-8 text-[11px]"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : null}
          Salvar
        </Button>
      </div>
    </form>
  );
}

function PaymentForm({
  ghlEventId,
  suggestedAmount,
  onSaved,
  onCancel,
}: {
  ghlEventId: string;
  suggestedAmount: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const register = useServerFn(registerAppointmentPayment);
  const [amountStr, setAmountStr] = useState(
    suggestedAmount > 0 ? String(suggestedAmount) : "",
  );
  const [type, setType] = useState<"deposit" | "final" | "refund">("final");
  const [method, setMethod] = useState<
    "cash" | "card" | "transfer" | "payconiq" | "other"
  >("cash");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: {
      ghlEventId: string;
      amountEur: number;
      type: "deposit" | "final" | "refund";
      method: "cash" | "card" | "transfer" | "payconiq" | "other";
      status: "pending" | "paid" | "refunded";
      paidAtISO: string;
      notes: string | null;
    }) => register({ data: payload }),
    onSuccess: () => {
      toast.success("Pagamento registrado.");
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(amountStr);
    if (!amount || amount <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    mutation.mutate({
      ghlEventId,
      amountEur: amount,
      type,
      method,
      status: "paid",
      paidAtISO: new Date().toISOString(),
      notes: notes.trim() || null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-3 rounded border border-border p-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px]">Valor (€)</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            required
          />
        </div>
        <div>
          <Label className="text-[10px]">Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger className="h-9 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deposit">Sinal</SelectItem>
              <SelectItem value="final">Final</SelectItem>
              <SelectItem value="refund">Reembolso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label className="text-[10px]">Método</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
            <SelectTrigger className="h-9 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Dinheiro</SelectItem>
              <SelectItem value="card">Cartão</SelectItem>
              <SelectItem value="transfer">Transferência</SelectItem>
              <SelectItem value="payconiq">Payconiq</SelectItem>
              <SelectItem value="other">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label className="text-[10px]">Notas (opcional)</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-[11px]"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          className="h-8 text-[11px]"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : null}
          Registrar
        </Button>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function ContactLine({
  icon,
  value,
  href,
  actionLabel,
  emptyLabel,
  onCopy,
}: {
  icon: React.ReactNode;
  value: string | null;
  href?: string;
  actionLabel: string;
  emptyLabel: string;
  onCopy: (v: string) => void;
}) {
  const { t } = useTranslation();
  if (!value) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{emptyLabel}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="min-w-0 flex-1 truncate text-sm">{value}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[11px]"
        onClick={() => onCopy(value)}
      >
        <Copy className="mr-1 h-3 w-3" />
        {t("agenda.details.copy")}
      </Button>
      {href ? (
        <a
          href={href}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] hover:bg-muted"
        >
          <ExternalLink className="h-3 w-3" />
          {actionLabel}
        </a>
      ) : null}
    </div>
  );
}

function formatWhen(locale: string, startMs: number, endMs: number): string {
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(startMs));
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${day} · ${time.format(new Date(startMs))} – ${time.format(new Date(endMs))}`;
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${m}min`;
}