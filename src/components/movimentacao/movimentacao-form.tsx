import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  Copy,
  History,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createMovimentacao,
  listRecentClients,
  type SlugContext,
  type ArtistOption,
  type MovimentacaoTipo,
} from "@/lib/movimentacao.functions";
import type { StaffRecebedorId } from "@/config/movimentacao-slugs";
import { haptic } from "@/lib/haptics";

interface Props {
  context: SlugContext;
  artists: ArtistOption[];
  artistsLoading?: boolean;
}

const TIPO_OPTIONS: { value: MovimentacaoTipo; label: string }[] = [
  { value: "sinal", label: "Sinal" },
  { value: "sessao", label: "Sessão" },
  { value: "saldo", label: "Saldo" },
  { value: "produto", label: "Produto" },
  { value: "estorno", label: "Estorno" },
];

const METODO_OPTIONS: {
  key: PaymentMethodKey;
  label: string;
  field: keyof FormState & `valor_${FormaPagamento}`;
}[] = [
  { key: "cartao", label: "Cartão", field: "valor_cartao" },
  { key: "dinheiro", label: "Dinheiro", field: "valor_dinheiro" },
  { key: "sumup", label: "SumUp", field: "valor_sumup" },
  { key: "transferencia", label: "Transferência", field: "valor_transferencia" },
];

type FormaPagamento = "cartao" | "dinheiro" | "sumup" | "transferencia";
type PaymentMethodKey = FormaPagamento;

function todayISO() {
  const now = new Date();
  const off = now.getTimezoneOffset();
  const d = new Date(now.getTime() - off * 60_000);
  return d.toISOString().slice(0, 10);
}

function fmtEur(v: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v);
}

function parseAmount(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function formatAmountInput(v: number): string {
  if (v === 0) return "";
  return v.toLocaleString("pt-PT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function newIdempotencyKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface FormState {
  nome_cliente: string;
  data_pagamento: string;
  artist_id: string;
  recebido_por_id: StaffRecebedorId;
  tipo_movimento: MovimentacaoTipo;
  valor_cartao: string;
  valor_dinheiro: string;
  valor_sumup: string;
  valor_transferencia: string;
  data_tatuagem: string;
  observacoes: string;
  chave_idempotencia: string;
}

function initialState(context: SlugContext): FormState {
  return {
    nome_cliente: "",
    data_pagamento: todayISO(),
    artist_id: context.defaultArtistId ?? "",
    recebido_por_id: context.defaultRecebedorId,
    tipo_movimento: "sessao",
    valor_cartao: "",
    valor_dinheiro: "",
    valor_sumup: "",
    valor_transferencia: "",
    data_tatuagem: "",
    observacoes: "",
    chave_idempotencia: newIdempotencyKey(),
  };
}

interface Confirmation {
  id: string;
  synced: boolean;
  nome_cliente: string;
  artistName: string;
  tipo: MovimentacaoTipo;
  metodo: string;
  total: number;
  criado_em: Date;
}

const TIPO_LABEL: Record<MovimentacaoTipo, string> = {
  sinal: "Sinal",
  sessao: "Sessão",
  saldo: "Saldo",
  produto: "Produto",
  estorno: "Estorno",
};

export function MovimentacaoForm({ context, artists, artistsLoading }: Props) {
  const [form, setForm] = useState<FormState>(() => initialState(context));
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [focusedMethod, setFocusedMethod] = useState<PaymentMethodKey | null>(null);
  const qc = useQueryClient();
  const submit = useServerFn(createMovimentacao);
  const fetchRecentClients = useServerFn(listRecentClients);

  const recentClientsQ = useQuery({
    queryKey: ["movimentacao-recent-clients", context.slug],
    queryFn: () => fetchRecentClients({ data: { slug: context.slug, limit: 20 } }),
    staleTime: 60_000,
  });

  const total = useMemo(
    () =>
      parseAmount(form.valor_cartao) +
      parseAmount(form.valor_dinheiro) +
      parseAmount(form.valor_sumup) +
      parseAmount(form.valor_transferencia),
    [form.valor_cartao, form.valor_dinheiro, form.valor_sumup, form.valor_transferencia],
  );

  const cartaoOn = parseAmount(form.valor_cartao) > 0;
  const sumupOn = parseAmount(form.valor_sumup) > 0;
  const exclusivoErro = cartaoOn && sumupOn;
  const isSinal = form.tipo_movimento === "sinal";
  const sinalErro = isSinal && !form.data_tatuagem;

  const step1Valid = form.nome_cliente.trim().length >= 2 && !!form.artist_id;
  const step2Valid = total > 0 && !exclusivoErro;
  const step3Valid = !sinalErro;

  const mutation = useMutation({
    mutationFn: async () => {
      return submit({
        data: {
          slug: context.slug,
          nome_cliente: form.nome_cliente,
          data_pagamento: form.data_pagamento,
          artist_id: form.artist_id,
          recebido_por_id: form.recebido_por_id,
          tipo_movimento: form.tipo_movimento,
          valor_cartao: parseAmount(form.valor_cartao),
          valor_dinheiro: parseAmount(form.valor_dinheiro),
          valor_sumup: parseAmount(form.valor_sumup),
          valor_transferencia: parseAmount(form.valor_transferencia),
          data_tatuagem: form.data_tatuagem || null,
          observacoes: form.observacoes || null,
          chave_idempotencia: form.chave_idempotencia,
        },
      });
    },
    onSuccess: (res) => {
      haptic("success");
      const synced = res.ghl_sync_status === "synced";
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      qc.invalidateQueries({ queryKey: ["movimentacao-recent-clients", context.slug] });
      toast.success(
        synced
          ? "Pagamento registado e sincronizado."
          : "Pagamento registado. Sincronização com o CRM pendente.",
      );
      const cartao = parseAmount(form.valor_cartao);
      const dinheiro = parseAmount(form.valor_dinheiro);
      const sumup = parseAmount(form.valor_sumup);
      const transf = parseAmount(form.valor_transferencia);
      const metodos: string[] = [];
      if (cartao > 0) metodos.push("Cartão");
      if (dinheiro > 0) metodos.push("Dinheiro");
      if (sumup > 0) metodos.push("SumUp");
      if (transf > 0) metodos.push("Transferência");
      const artistName = artists.find((a) => a.id === form.artist_id)?.name ?? "—";
      setConfirmation({
        id: res.id,
        synced,
        nome_cliente: form.nome_cliente.trim(),
        artistName,
        tipo: form.tipo_movimento,
        metodo: metodos.length > 1 ? "Misto" : metodos[0] ?? "—",
        total: cartao + dinheiro + sumup + transf,
        criado_em: new Date(),
      });
    },
    onError: (err) => {
      haptic("warning");
      toast.error(err instanceof Error ? err.message : "Falha ao registar.");
    },
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function nextStep() {
    haptic("tap");
    if (step === 1 && step1Valid) setStep(2);
    else if (step === 2 && step2Valid) setStep(3);
  }

  function prevStep() {
    haptic("tap");
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  function resetForm() {
    setConfirmation(null);
    setForm(initialState(context));
    setStep(1);
    setFocusedMethod(null);
  }

  function setAmountForMethod(method: PaymentMethodKey, raw: string) {
    const field = METODO_OPTIONS.find((m) => m.key === method)?.field;
    if (!field) return;
    setForm((s) => ({ ...s, [field]: raw }));
  }

  function getAmountForMethod(method: PaymentMethodKey): string {
    switch (method) {
      case "cartao":
        return form.valor_cartao;
      case "dinheiro":
        return form.valor_dinheiro;
      case "sumup":
        return form.valor_sumup;
      case "transferencia":
        return form.valor_transferencia;
    }
  }

  function isMethodActive(method: PaymentMethodKey): boolean {
    return parseAmount(getAmountForMethod(method)) > 0;
  }

  function toggleMethod(method: PaymentMethodKey) {
    haptic("tap");
    const active = isMethodActive(method);
    if (active) {
      setAmountForMethod(method, "");
      if (focusedMethod === method) setFocusedMethod(null);
    } else {
      setFocusedMethod(method);
      // Focus the input on next tick.
      setTimeout(() => {
        const el = document.getElementById(`amount-${method}`);
        if (el) el.focus();
      }, 0);
    }
  }

  function applyQuickAmount(amount: number) {
    haptic("tap");
    const activeMethods = METODO_OPTIONS.filter((m) => isMethodActive(m.key)).map((m) => m.key);
    let target: PaymentMethodKey | null = focusedMethod;
    if (!target || !isMethodActive(target)) {
      target = activeMethods[0] ?? null;
    }
    if (!target) {
      // Default to dinheiro if nothing selected.
      target = "dinheiro";
    }
    const current = parseAmount(getAmountForMethod(target));
    setAmountForMethod(target, formatAmountInput(current + amount));
    setFocusedMethod(target);
  }

  if (confirmation) {
    return (
      <ConfirmationScreen
        data={confirmation}
        onNew={resetForm}
      />
    );
  }

  return (
    <div className="wizard-scope flex flex-col">
      <Stepper step={step} />

      <div className="mt-4 space-y-5">
        {step === 1 && (
          <StepOne
            form={form}
            set={set}
            context={context}
            artists={artists}
            artistsLoading={artistsLoading}
            recentClients={recentClientsQ.data ?? []}
          />
        )}

        {step === 2 && (
          <StepTwo
            form={form}
            set={set}
            total={total}
            exclusivoErro={exclusivoErro}
            focusedMethod={focusedMethod}
            setFocusedMethod={setFocusedMethod}
            isMethodActive={isMethodActive}
            toggleMethod={toggleMethod}
            getAmountForMethod={getAmountForMethod}
            setAmountForMethod={setAmountForMethod}
            applyQuickAmount={applyQuickAmount}
          />
        )}

        {step === 3 && (
          <StepThree
            form={form}
            set={set}
            total={total}
            isSinal={isSinal}
            sinalErro={sinalErro}
            artists={artists}
          />
        )}
      </div>

      <WizardFooter
        step={step}
        onBack={prevStep}
        onNext={nextStep}
        onSubmit={() => mutation.mutate()}
        canNext={
          (step === 1 && step1Valid) || (step === 2 && step2Valid) || false
        }
        canSubmit={step === 3 && step3Valid && total > 0 && !exclusivoErro && !mutation.isPending}
        isSubmitting={mutation.isPending}
        total={total}
      />
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold transition-colors ${
            n === step
              ? "bg-primary text-primary-foreground"
              : n < step
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {n < step ? <CheckCircle2 className="h-4 w-4" /> : n}
        </div>
      ))}
    </div>
  );
}

interface StepOneProps {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  context: SlugContext;
  artists: ArtistOption[];
  artistsLoading?: boolean;
  recentClients: string[];
}

function StepOne({ form, set, context, artists, artistsLoading, recentClients }: StepOneProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = form.nome_cliente.trim().toLowerCase();
    if (!q) return recentClients.slice(0, 6);
    return recentClients
      .filter((c) => c.toLowerCase().includes(q))
      .filter((c) => c.toLowerCase() !== q)
      .slice(0, 6);
  }, [form.nome_cliente, recentClients]);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="recebido_por_id">Recebido por *</Label>
        <Select
          value={form.recebido_por_id}
          onValueChange={(v) => set("recebido_por_id", v as StaffRecebedorId)}
        >
          <SelectTrigger id="recebido_por_id" className="h-14 text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {context.recebedores.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative space-y-1.5">
        <Label htmlFor="nome_cliente">Nome do cliente *</Label>
        <Input
          ref={inputRef}
          id="nome_cliente"
          value={form.nome_cliente}
          onChange={(e) => set("nome_cliente", e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          autoComplete="off"
          className="h-14 text-base"
          placeholder="Ex: Ana Silva"
          required
        />
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
            <div className="max-h-48 overflow-auto py-1">
              {filtered.map((name) => (
                <button
                  key={name}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    set("nome_cliente", name);
                    setShowSuggestions(false);
                    inputRef.current?.focus();
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="artist_id">Tatuador *</Label>
        <Select value={form.artist_id} onValueChange={(v) => set("artist_id", v)}>
          <SelectTrigger id="artist_id" className="h-14 text-base">
            <SelectValue placeholder={artistsLoading ? "A carregar…" : "Selecione"} />
          </SelectTrigger>
          <SelectContent>
            {artists.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

interface StepTwoProps {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  total: number;
  exclusivoErro: boolean;
  focusedMethod: PaymentMethodKey | null;
  setFocusedMethod: (m: PaymentMethodKey | null) => void;
  isMethodActive: (m: PaymentMethodKey) => boolean;
  toggleMethod: (m: PaymentMethodKey) => void;
  getAmountForMethod: (m: PaymentMethodKey) => string;
  setAmountForMethod: (m: PaymentMethodKey, v: string) => void;
  applyQuickAmount: (n: number) => void;
}

function StepTwo({
  form,
  set,
  total,
  exclusivoErro,
  focusedMethod,
  setFocusedMethod,
  isMethodActive,
  toggleMethod,
  getAmountForMethod,
  setAmountForMethod,
  applyQuickAmount,
}: StepTwoProps) {
  const quickAmounts = [50, 100, 150, 200, 250];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Tipo de movimento *</Label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {TIPO_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => set("tipo_movimento", o.value)}
              className={`rounded-lg border px-2 py-3 text-sm font-medium transition-colors ${
                form.tipo_movimento === o.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Método de pagamento *</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {METODO_OPTIONS.map((m) => {
            const active = isMethodActive(m.key);
            const disabled =
              (m.key === "cartao" && parseAmount(form.valor_sumup) > 0) ||
              (m.key === "sumup" && parseAmount(form.valor_cartao) > 0);
            return (
              <button
                key={m.key}
                type="button"
                disabled={disabled}
                onClick={() => toggleMethod(m.key)}
                className={`relative rounded-lg border px-2 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : disabled
                      ? "border-border bg-muted text-muted-foreground opacity-60"
                      : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {m.label}
                {active && (
                  <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-primary-foreground" />
                )}
              </button>
            );
          })}
        </div>
        {exclusivoErro && (
          <p className="text-xs text-destructive">
            SumUp e Cartão são métodos exclusivos — deixe um deles em €0.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Valores rápidos</Label>
        <div className="flex flex-wrap gap-2">
          {quickAmounts.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => applyQuickAmount(n)}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              +€{n}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Valores por método</Label>
        {METODO_OPTIONS.map((m) => {
          const active = isMethodActive(m.key);
          if (!active) return null;
          return (
            <div key={m.key} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm font-medium">{m.label}</span>
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm text-muted-foreground">
                  €
                </span>
                <Input
                  id={`amount-${m.key}`}
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={getAmountForMethod(m.key)}
                  onFocus={() => setFocusedMethod(m.key)}
                  onChange={(e) => setAmountForMethod(m.key, e.target.value)}
                  className="h-14 pl-8 text-right text-base tabular-nums"
                />
              </div>
            </div>
          );
        })}
        {!METODO_OPTIONS.some((m) => isMethodActive(m.key)) && (
          <p className="rounded-md border border-dashed border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
            Selecione um método de pagamento acima.
          </p>
        )}
      </div>

      <div className="sticky bottom-0 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-sm uppercase tracking-wider text-muted-foreground">Total</span>
          <span
            className="text-3xl font-bold tabular-nums"
            style={{ color: total > 0 ? "#E11D2A" : undefined }}
          >
            {fmtEur(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface StepThreeProps {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  total: number;
  isSinal: boolean;
  sinalErro: boolean;
  artists: ArtistOption[];
}

function StepThree({ form, set, total, isSinal, sinalErro, artists }: StepThreeProps) {
  const artistName = artists.find((a) => a.id === form.artist_id)?.name ?? "—";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="data_pagamento">Data do pagamento *</Label>
          <Input
            id="data_pagamento"
            type="date"
            value={form.data_pagamento}
            onChange={(e) => set("data_pagamento", e.target.value)}
            className="h-14 text-base"
            required
          />
        </div>
        <div
          className={`space-y-1.5 ${
            isSinal ? "rounded-md border-2 border-primary/60 bg-primary/5 p-2 -m-0.5" : ""
          }`}
        >
          <Label htmlFor="data_tatuagem">
            {isSinal ? "Data da sessão *" : "Data da sessão"}
          </Label>
          <Input
            id="data_tatuagem"
            type="date"
            value={form.data_tatuagem}
            onChange={(e) => set("data_tatuagem", e.target.value)}
            className="h-14 text-base"
            required={isSinal}
          />
          {sinalErro && (
            <p className="text-xs text-destructive">Informe a data da sessão agendada.</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          value={form.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          rows={3}
          maxLength={1000}
          className="text-base"
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Resumo
        </h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Cliente</dt>
          <dd className="truncate font-medium">{form.nome_cliente.trim() || "—"}</dd>
          <dt className="text-muted-foreground">Tatuador</dt>
          <dd className="font-medium">{artistName}</dd>
          <dt className="text-muted-foreground">Tipo</dt>
          <dd className="font-medium">{TIPO_LABEL[form.tipo_movimento]}</dd>
          <dt className="text-muted-foreground">Total</dt>
          <dd className="font-bold tabular-nums" style={{ color: total > 0 ? "#E11D2A" : undefined }}>
            {fmtEur(total)}
          </dd>
        </dl>
      </div>
    </div>
  );
}

interface WizardFooterProps {
  step: 1 | 2 | 3;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  canNext: boolean;
  canSubmit: boolean;
  isSubmitting: boolean;
  total: number;
}

function WizardFooter({
  step,
  onBack,
  onNext,
  onSubmit,
  canNext,
  canSubmit,
  isSubmitting,
}: WizardFooterProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur">
      <div className="mx-auto flex max-w-md gap-3">
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="h-14 px-5 text-base"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>
        )}
        {step < 3 ? (
          <Button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            className="h-14 flex-1 text-base font-semibold"
          >
            Próximo
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="h-14 flex-1 text-base font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A registar…
              </>
            ) : (
              "Registar pagamento"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function ConfirmationScreen({
  data,
  onNew,
}: {
  data: Confirmation;
  onNew: () => void;
}) {
  const ok = data.synced;
  const color = ok ? "#16a34a" : "#d97706";
  const dateStr = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data.criado_em);
  const timeStr = new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(data.criado_em);

  async function copySummary() {
    const text = `${data.nome_cliente} — ${fmtEur(data.total)} (${data.metodo})`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Resumo copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <div className="rounded-xl bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        {ok ? (
          <CheckCircle2 className="h-8 w-8 shrink-0" style={{ color }} />
        ) : (
          <AlertTriangle className="h-8 w-8 shrink-0" style={{ color }} />
        )}
        <h2 className="text-base font-semibold">
          {ok ? "Pagamento registado!" : "Guardado — sincronização pendente"}
        </h2>
      </div>

      <Badge
        variant={ok ? "default" : "secondary"}
        className="mb-4"
        style={{ backgroundColor: ok ? color : undefined }}
      >
        {ok ? "Sincronizado com GHL" : "Sync GHL pendente"}
      </Badge>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-border pt-4 text-sm">
        <dt className="text-muted-foreground">Cliente</dt>
        <dd className="font-medium">{data.nome_cliente}</dd>
        <dt className="text-muted-foreground">Tatuador</dt>
        <dd className="font-medium">{data.artistName}</dd>
        <dt className="text-muted-foreground">Tipo</dt>
        <dd className="font-medium">{TIPO_LABEL[data.tipo]}</dd>
        <dt className="text-muted-foreground">Método</dt>
        <dd className="font-medium">{data.metodo}</dd>
        <dt className="text-muted-foreground">Total</dt>
        <dd className="font-bold tabular-nums">{fmtEur(data.total)}</dd>
      </dl>

      <p className="mt-4 text-xs text-muted-foreground">
        Registado em {dateStr} às {timeStr}
      </p>

      <div className="mt-5 grid gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={copySummary}
          className="h-12 w-full text-base"
        >
          <Copy className="mr-2 h-4 w-4" />
          Copiar resumo
        </Button>

        <a
          href={`/movimentacao/historico?highlight=${encodeURIComponent(data.id)}`}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border border-border bg-background text-base font-medium hover:bg-muted"
        >
          <History className="h-4 w-4" />
          Ver no histórico
        </a>

        <Button
          type="button"
          onClick={onNew}
          className="h-14 w-full text-base font-semibold"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo registo
        </Button>
      </div>
    </div>
  );
}
