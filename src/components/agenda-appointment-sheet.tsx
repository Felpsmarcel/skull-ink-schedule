import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
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
  setAppointmentSeller,
  reassignAppointmentArtist,
  type AppointmentFinanceView,
} from "@/lib/appointments.functions";
import { listSellers } from "@/lib/sellers.functions";
import { listAllServices } from "@/lib/services.functions";
import { useArtists } from "@/hooks/use-artists";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { haptic } from "@/lib/haptics";
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
  const isMobile = useIsMobile();

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
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "flex h-[92dvh] w-full flex-col rounded-t-2xl p-0 pt-3 pb-[env(safe-area-inset-bottom)]"
            : "w-full pt-[max(1rem,env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)] sm:max-w-md sm:pt-6"
        }
      >
        {isMobile ? (
          <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-border" aria-hidden />
        ) : null}
        <SheetHeader className={isMobile ? "shrink-0 px-4 text-left" : "text-left"}>
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

        <div
          className={
            isMobile
              ? "mt-4 flex-1 space-y-5 overflow-y-auto px-4 pb-6 text-sm"
              : "mt-6 space-y-5 overflow-y-auto pb-6 text-sm"
          }
        >
          {slot?.hasOverlap ? (
            <div className="flex items-start gap-2 rounded border border-border bg-muted p-2 text-[12px] text-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{t("agenda.details.overlap")}</span>
            </div>
          ) : null}

          {slot?.ghlEventId ? (
            <ArtistPicker
              ghlEventId={slot.ghlEventId}
              currentCalendarId={calendarId}
              currentName={staffName}
            />
          ) : (
            <Row label={t("agenda.details.artist")} value={staffName} />
          )}
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
          ghlEventId={ghlEventId}
          onOverrideChanged={invalidateAll}
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
          totalEur={financeQ.data.totalEur ?? 0}
          paidTotalEur={financeQ.data.paidTotalEur ?? 0}
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

      <SellerPicker
        ghlEventId={ghlEventId}
        current={data.seller?.id ?? null}
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
        {data.depositEur > 0 ? (
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Sinal
            </div>
            <div className="text-sm font-semibold tabular-nums">
              {currency(locale, data.depositEur)}
            </div>
          </div>
        ) : null}
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Recebido
          </div>
          <div className="text-sm font-semibold tabular-nums">
            {currency(locale, data.paidTotalEur)}
          </div>
        </div>
        {(() => {
          const bal = data.balanceEur;
          let label = data.depositEur > 0 ? "Saldo restante" : "Saldo";
          let cls = "text-sm font-semibold tabular-nums";
          let icon: React.ReactNode = null;
          if (bal != null) {
            if (bal > 0.005) {
              label = "Falta a receber";
              cls += " text-destructive";
            } else if (bal < -0.005) {
              label = "Crédito do cliente";
              cls += " text-amber-600";
              icon = <AlertTriangle className="inline h-3 w-3 mr-1" />;
            } else {
              label = "Quitado";
              cls += " text-emerald-600";
            }
          }
          return (
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                {label}
              </div>
              <div className={cls}>
                {icon}
                {currency(locale, bal)}
              </div>
            </div>
          );
        })()}
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Comissão ({data.commissionPct ?? "—"}%)
          </div>
          <div className="text-sm font-semibold tabular-nums">
            {currency(locale, data.commissionEur)}
          </div>
        </div>
        {data.seller ? (
          <div className="col-span-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Comissão vendedor · {data.seller.name} ({data.seller.commissionPct}%)
            </div>
            <div className="text-sm font-semibold tabular-nums">
              {currency(locale, data.seller.commissionEur)}
            </div>
          </div>
        ) : null}
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
  totalEur,
  paidTotalEur,
  onSaved,
  onCancel,
}: {
  ghlEventId: string;
  totalEur: number;
  paidTotalEur: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const register = useServerFn(registerAppointmentPayment);
  const [amountStr, setAmountStr] = useState("");
  const [type, setType] = useState<"deposit" | "final" | "refund">("final");
  const [method, setMethod] = useState<
    "cash" | "card" | "transfer" | "payconiq" | "other"
  >("cash");
  const [notes, setNotes] = useState("");
  const [confirmOver, setConfirmOver] = useState(false);

  const amount = Number(amountStr) || 0;
  const projectedPaid =
    type === "refund" ? paidTotalEur - amount : paidTotalEur + amount;
  const excess = totalEur > 0 ? projectedPaid - totalEur : 0;
  const overpay = type !== "refund" && amount > 0 && totalEur > 0 && excess > 0.005;

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
      haptic("success");
      toast.success("Pagamento registrado.");
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (overpay && !confirmOver) {
      toast.error("Confirme o valor excedente para continuar.");
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
      {overpay ? (
        <div className="rounded border border-amber-500/50 bg-amber-500/10 p-2 text-[11px] text-amber-800 dark:text-amber-300">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="space-y-1">
              <div>
                Este pagamento excede o total em{" "}
                <strong>€{excess.toFixed(2)}</strong>.
              </div>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={confirmOver}
                  onChange={(e) => setConfirmOver(e.target.checked)}
                />
                <span>Confirmo o valor excedente</span>
              </label>
            </div>
          </div>
        </div>
      ) : null}
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
          disabled={mutation.isPending || (overpay && !confirmOver)}
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

function PaymentStatusPicker({
  ghlEventId,
  current,
  onChanged,
}: {
  ghlEventId: string;
  current: "pago" | "pendente" | "a_receber" | null;
  onChanged: () => void;
}) {
  const setStatus = useServerFn(setAppointmentPaymentStatus);
  const mut = useMutation({
    mutationFn: async (status: "pago" | "pendente" | "a_receber" | null) =>
      setStatus({ data: { ghlEventId, status } }),
    onSuccess: () => {
      toast.success("Status atualizado");
      onChanged();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar"),
  });

  const value = current ?? "auto";
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-muted/20 p-2">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Status
      </Label>
      <Select
        value={value}
        onValueChange={(v) => {
          const next = v === "auto" ? null : (v as "pago" | "pendente" | "a_receber");
          mut.mutate(next);
        }}
        disabled={mut.isPending}
      >
        <SelectTrigger className="h-9 flex-1 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Automático</SelectItem>
          <SelectItem value="pago">Pago</SelectItem>
          <SelectItem value="pendente">Pendente</SelectItem>
          <SelectItem value="a_receber">A receber</SelectItem>
        </SelectContent>
      </Select>
      {current ? (
        <Lock className="h-3 w-3 text-muted-foreground" aria-label="Status manual" />
      ) : null}
      {mut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
    </div>
  );
}

function ArtistPicker({
  ghlEventId,
  currentCalendarId,
  currentName,
}: {
  ghlEventId: string;
  currentCalendarId: string;
  currentName: string;
}) {
  const queryClient = useQueryClient();
  const reassign = useServerFn(reassignAppointmentArtist);
  const artistsQ = useArtists();
  const artists = artistsQ.data ?? [];
  const currentArtist = artists.find((a) => a.calendarId === currentCalendarId);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async (newArtistId: string) =>
      reassign({ data: { ghlEventId, newArtistId } }),
    onSuccess: () => {
      haptic("success");
      toast.success("Tatuador atualizado");
      setPendingId(null);
      queryClient.invalidateQueries({ queryKey: ["agenda"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-status"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-finance", ghlEventId] });
    },
    onError: (err: unknown) => {
      setPendingId(null);
      toast.error(err instanceof Error ? err.message : "Falha ao reatribuir");
    },
  });

  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Tatuador
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={currentArtist?.id ?? ""}
          onValueChange={(v) => {
            if (!currentArtist || v === currentArtist.id) return;
            setPendingId(v);
          }}
          disabled={mut.isPending || artistsQ.isLoading}
        >
          <SelectTrigger className="h-9 flex-1 text-xs">
            <SelectValue placeholder={currentName} />
          </SelectTrigger>
          <SelectContent>
            {artists.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {mut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      </div>
      {pendingId && !mut.isPending ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded border border-amber-500/50 bg-amber-500/10 p-2 text-[11px]">
          <span>
            Reatribuir para{" "}
            <strong>{artists.find((a) => a.id === pendingId)?.name}</strong>?
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              onClick={() => setPendingId(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => mut.mutate(pendingId)}
            >
              Confirmar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SellerPicker({
  ghlEventId,
  current,
  onChanged,
}: {
  ghlEventId: string;
  current: string | null;
  onChanged: () => void;
}) {
  const setSeller = useServerFn(setAppointmentSeller);
  const fetchSellers = useServerFn(listSellers);
  const sellersQ = useQuery({
    queryKey: ["sellers", "active"],
    queryFn: () => fetchSellers({ data: {} }),
    staleTime: 5 * 60_000,
  });
  const mut = useMutation({
    mutationFn: async (sellerId: string | null) =>
      setSeller({ data: { ghlEventId, sellerId } }),
    onSuccess: () => {
      toast.success("Vendedor atualizado");
      onChanged();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar"),
  });

  const sellers = sellersQ.data ?? [];
  const value = current ?? "none";

  return (
    <div className="flex items-center gap-2 rounded border border-border bg-muted/20 p-2">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Vendedor
      </Label>
      <Select
        value={value}
        onValueChange={(v) => {
          const next = v === "none" ? null : v;
          mut.mutate(next);
        }}
        disabled={mut.isPending || sellersQ.isLoading}
      >
        <SelectTrigger className="h-9 flex-1 text-xs">
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
      {mut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
    </div>
  );
}