import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createMovimentacao,
  type SlugContext,
  type ArtistOption,
  type MovimentacaoTipo,
} from "@/lib/movimentacao.functions";
import { haptic } from "@/lib/haptics";

interface Props {
  context: SlugContext;
  artists: ArtistOption[];
  artistsLoading?: boolean;
}

const TIPO_OPTIONS: { value: MovimentacaoTipo; label: string }[] = [
  { value: "sinal", label: "Sinal (reserva)" },
  { value: "sessao", label: "Sessão (pagamento do dia)" },
  { value: "saldo", label: "Saldo (quitação)" },
  { value: "produto", label: "Produto / cuidados" },
  { value: "estorno", label: "Estorno" },
];

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

function newIdempotencyKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  // fallback rústico
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface FormState {
  nome_cliente: string;
  data_pagamento: string;
  artist_id: string;
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

export function MovimentacaoForm({ context, artists, artistsLoading }: Props) {
  const [form, setForm] = useState<FormState>(() => initialState(context));
  const [lastResult, setLastResult] = useState<null | { synced: boolean }>(null);
  const qc = useQueryClient();
  const submit = useServerFn(createMovimentacao);

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

  const mutation = useMutation({
    mutationFn: async () => {
      return submit({
        data: {
          slug: context.slug,
          nome_cliente: form.nome_cliente,
          data_pagamento: form.data_pagamento,
          artist_id: form.artist_id,
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
      setLastResult({ synced });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      toast.success(
        synced
          ? "Pagamento registado e sincronizado."
          : "Pagamento registado. Sincronização com o CRM pendente.",
      );
      // reset preservando slug/tatuador padrão/data hoje
      setForm(initialState(context));
    },
    onError: (err) => {
      haptic("error");
      toast.error(err instanceof Error ? err.message : "Falha ao registar.");
    },
  });

  const disabled =
    mutation.isPending ||
    exclusivoErro ||
    sinalErro ||
    total <= 0 ||
    !form.nome_cliente.trim() ||
    !form.artist_id;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  return (
    <form
      className="wizard-scope space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;
        mutation.mutate();
      }}
    >
      {/* Recebido por (read-only) */}
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
        <span className="text-muted-foreground">Recebido por: </span>
        <span className="font-semibold">{context.recebidoPorNome}</span>
        {context.isAdmin && !context.isOwner && (
          <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-400">
            admin
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nome_cliente">Nome do cliente *</Label>
        <Input
          id="nome_cliente"
          value={form.nome_cliente}
          onChange={(e) => set("nome_cliente", e.target.value)}
          autoComplete="off"
          className="h-11"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="data_pagamento">Data do pagamento *</Label>
          <Input
            id="data_pagamento"
            type="date"
            value={form.data_pagamento}
            onChange={(e) => set("data_pagamento", e.target.value)}
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tipo_movimento">Tipo *</Label>
          <Select
            value={form.tipo_movimento}
            onValueChange={(v) => set("tipo_movimento", v as MovimentacaoTipo)}
          >
            <SelectTrigger id="tipo_movimento" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPO_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="artist_id">Tatuador *</Label>
        <Select value={form.artist_id} onValueChange={(v) => set("artist_id", v)}>
          <SelectTrigger id="artist_id" className="h-11">
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

      {/* Valores */}
      <fieldset className="space-y-3 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Valores recebidos
        </legend>
        <MoneyField
          id="valor_cartao"
          label="Cartão"
          value={form.valor_cartao}
          onChange={(v) => set("valor_cartao", v)}
          disabled={sumupOn}
        />
        <MoneyField
          id="valor_dinheiro"
          label="Dinheiro"
          value={form.valor_dinheiro}
          onChange={(v) => set("valor_dinheiro", v)}
        />
        <MoneyField
          id="valor_sumup"
          label="SumUp"
          value={form.valor_sumup}
          onChange={(v) => set("valor_sumup", v)}
          disabled={cartaoOn}
        />
        <MoneyField
          id="valor_transferencia"
          label="Transferência"
          value={form.valor_transferencia}
          onChange={(v) => set("valor_transferencia", v)}
        />
        {exclusivoErro && (
          <p className="text-xs text-destructive">
            SumUp e Cartão são métodos exclusivos — deixe um deles em €0.
          </p>
        )}
        <div className="flex items-baseline justify-between border-t border-border pt-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ color: total > 0 ? "#E11D2A" : undefined }}
          >
            {fmtEur(total)}
          </span>
        </div>
      </fieldset>

      <div
        className={`space-y-1.5 ${
          isSinal ? "rounded-md border-2 border-primary/60 bg-primary/5 p-3" : ""
        }`}
      >
        <Label htmlFor="data_tatuagem">
          Data da sessão agendada {isSinal ? "*" : "(opcional)"}
        </Label>
        <Input
          id="data_tatuagem"
          type="date"
          value={form.data_tatuagem}
          onChange={(e) => set("data_tatuagem", e.target.value)}
          className="h-11"
          required={isSinal}
        />
        {isSinal && (
          <p className="text-xs text-muted-foreground">
            Para sinal, informe a data em que a sessão está marcada.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          value={form.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          rows={3}
          maxLength={1000}
        />
      </div>

      <Button
        type="submit"
        className="h-12 w-full text-base font-semibold"
        disabled={disabled}
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            A registar…
          </>
        ) : (
          "Registar pagamento"
        )}
      </Button>

      {lastResult && !mutation.isPending && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          Pagamento registado.
          {!lastResult.synced && " (Sincronização com CRM pendente.)"}
        </div>
      )}
    </form>
  );
}

interface MoneyFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

function MoneyField({ id, label, value, onChange, disabled }: MoneyFieldProps) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="w-28 shrink-0 text-sm">
        {label}
      </Label>
      <div className="relative flex-1">
        <span className="pointer-events-none absolute inset-y-0 left-2 grid place-items-center text-xs text-muted-foreground">
          €
        </span>
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 pl-6 text-right tabular-nums"
        />
      </div>
    </div>
  );
}