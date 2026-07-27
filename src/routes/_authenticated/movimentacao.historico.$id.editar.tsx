import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getMovimentacaoForEdit,
  updateMovimentacao,
  softDeleteMovimentacao,
  resyncMovimentacaoGhl,
  listArtistsForSelect,
  listMovimentacaoAudit,
  type MovimentacaoEditRow,
  type MovimentacaoTipo,
} from "@/lib/movimentacao.functions";

export const Route = createFileRoute(
  "/_authenticated/movimentacao/historico/$id/editar",
)({
  head: () => ({
    meta: [
      { title: "Editar pagamento — GF Tattoo" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: EditarPage,
});

const TIPO_OPTIONS: Array<{ value: MovimentacaoTipo; label: string }> = [
  { value: "sinal", label: "Sinal" },
  { value: "sessao", label: "Sessão pagamento do dia" },
  { value: "saldo", label: "Valor total" },
  { value: "produto", label: "Produto GF TATTOO" },
  { value: "estorno", label: "Estorno" },
];

const currencyFmt = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

function EditarPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();

  const fetchRow = useServerFn(getMovimentacaoForEdit);
  const fetchArtists = useServerFn(listArtistsForSelect);
  const doUpdate = useServerFn(updateMovimentacao);
  const doDelete = useServerFn(softDeleteMovimentacao);
  const doResync = useServerFn(resyncMovimentacaoGhl);
  const fetchAudit = useServerFn(listMovimentacaoAudit);

  const rowQ = useQuery<MovimentacaoEditRow>({
    queryKey: ["movimentacao-edit", id],
    queryFn: () => fetchRow({ data: { id } }),
    retry: false,
  });

  const artistsQ = useQuery({
    queryKey: ["movimentacao-artists"],
    queryFn: () => fetchArtists(),
    staleTime: 5 * 60_000,
  });

  const auditQ = useQuery({
    queryKey: ["movimentacao-audit", id],
    queryFn: () => fetchAudit({ data: { id } }),
    retry: false,
  });

  const [form, setForm] = useState<null | {
    nome_cliente: string;
    artist_id: string;
    tipo_movimento: MovimentacaoTipo;
    valor_cartao: string;
    valor_dinheiro: string;
    valor_sumup: string;
    valor_transferencia: string;
  }>(null);

  useEffect(() => {
    if (!rowQ.data || form) return;
    setForm({
      nome_cliente: rowQ.data.nome_cliente,
      artist_id: rowQ.data.artist_id,
      tipo_movimento: rowQ.data.tipo_movimento,
      valor_cartao: String(rowQ.data.valor_cartao ?? 0),
      valor_dinheiro: String(rowQ.data.valor_dinheiro ?? 0),
      valor_sumup: String(rowQ.data.valor_sumup ?? 0),
      valor_transferencia: String(rowQ.data.valor_transferencia ?? 0),
    });
  }, [rowQ.data, form]);

  const backToList = () =>
    navigate({
      to: "/movimentacao/historico",
      search: { page: 1, highlight: id },
    });

  const updateMut = useMutation({
    mutationFn: (input: {
      nome_cliente: string;
      artist_id: string;
      tipo_movimento: MovimentacaoTipo;
      valor_cartao: number;
      valor_dinheiro: number;
      valor_sumup: number;
      valor_transferencia: number;
    }) => doUpdate({ data: { id, ...input } }),
    onSuccess: () => {
      toast.success("Alterações guardadas.");
      qc.invalidateQueries({ queryKey: ["movimentacao-historico"] });
      qc.invalidateQueries({ queryKey: ["movimentacao-edit", id] });
      backToList();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => doDelete({ data: { id } }),
    onSuccess: () => {
      toast.success("Registo apagado.");
      qc.invalidateQueries({ queryKey: ["movimentacao-historico"] });
      navigate({ to: "/movimentacao/historico", search: { page: 1, highlight: "" } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resyncMut = useMutation({
    mutationFn: () => doResync({ data: { id } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Sincronizado com GHL.");
      } else {
        toast.error("Falha na sincronização.");
      }
      qc.invalidateQueries({ queryKey: ["movimentacao-historico"] });
      qc.invalidateQueries({ queryKey: ["movimentacao-edit", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (rowQ.isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (rowQ.isError || !rowQ.data) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <p className="text-sm text-slate-700">Não foi possível carregar o registo.</p>
        <button
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
          onClick={() => router.invalidate()}
        >
          Tentar novamente
        </button>
      </div>
    );
  }
  if (!rowQ.data.canEdit) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <p className="text-sm text-slate-700">Sem permissão para editar este registo.</p>
        <button
          className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm"
          onClick={backToList}
        >
          Voltar ao histórico
        </button>
      </div>
    );
  }
  if (!form) return null;

  const totalPreview =
    (Number(form.valor_cartao) || 0) +
    (Number(form.valor_dinheiro) || 0) +
    (Number(form.valor_sumup) || 0) +
    (Number(form.valor_transferencia) || 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMut.mutate({
      nome_cliente: form.nome_cliente,
      artist_id: form.artist_id,
      tipo_movimento: form.tipo_movimento,
      valor_cartao: Number(form.valor_cartao) || 0,
      valor_dinheiro: Number(form.valor_dinheiro) || 0,
      valor_sumup: Number(form.valor_sumup) || 0,
      valor_transferencia: Number(form.valor_transferencia) || 0,
    });
  };

  const busy = updateMut.isPending || deleteMut.isPending || resyncMut.isPending;

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col bg-white pb-[calc(env(safe-area-inset-bottom)+7rem)] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={backToList}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="size-4" /> Voltar
          </button>
          <h1 className="ml-1 text-base font-bold">Editar pagamento</h1>
        </div>
      </header>

      <form onSubmit={submit} className="flex flex-1 flex-col gap-4 px-4 py-4">
        <Field label="Nome do cliente">
          <input
            type="text"
            required
            maxLength={120}
            value={form.nome_cliente}
            onChange={(e) => setForm({ ...form, nome_cliente: e.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>

        <Field label="Tatuador">
          <select
            required
            value={form.artist_id}
            onChange={(e) => setForm({ ...form, artist_id: e.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
          >
            {(artistsQ.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tipo">
          <select
            value={form.tipo_movimento}
            onChange={(e) =>
              setForm({ ...form, tipo_movimento: e.target.value as MovimentacaoTipo })
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
          >
            {TIPO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <MoneyField
            label="Cartão"
            value={form.valor_cartao}
            onChange={(v) => setForm({ ...form, valor_cartao: v })}
          />
          <MoneyField
            label="Dinheiro"
            value={form.valor_dinheiro}
            onChange={(v) => setForm({ ...form, valor_dinheiro: v })}
          />
          <MoneyField
            label="SumUp"
            value={form.valor_sumup}
            onChange={(v) => setForm({ ...form, valor_sumup: v })}
          />
          <MoneyField
            label="Transferência"
            value={form.valor_transferencia}
            onChange={(v) => setForm({ ...form, valor_transferencia: v })}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Total</span>
            <span className="text-lg font-bold text-slate-900">
              {currencyFmt.format(totalPreview)}
            </span>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => resyncMut.mutate()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className="size-4" /> Ressincronizar GHL
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Apagar este registo? Esta ação pode ser revertida por um admin.")) {
                deleteMut.mutate();
              }
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="size-4" /> Apagar registo
          </button>
        </div>
      </form>

      <section className="px-4 pb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Histórico de alterações
        </h2>
        {rowQ.data?.registrado_por_nome && (
          <p className="mb-2 text-xs text-slate-500">
            Registado por {rowQ.data.registrado_por_nome}
            {rowQ.data.registrado_em
              ? ` em ${new Date(rowQ.data.registrado_em).toLocaleString("pt-PT")}`
              : ""}
          </p>
        )}
        {auditQ.isLoading ? (
          <p className="text-xs text-slate-400">A carregar…</p>
        ) : (auditQ.data?.length ?? 0) === 0 ? (
          <p className="text-xs text-slate-400">Sem alterações registadas.</p>
        ) : (
          <ul className="space-y-2">
            {auditQ.data!.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">
                    {entry.acao === "insert"
                      ? "Criado"
                      : entry.acao === "delete"
                        ? "Apagado"
                        : "Editado"}
                    {entry.actor ? ` · ${entry.actor}` : ""}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(entry.created_at).toLocaleString("pt-PT")}
                  </span>
                </div>
                {entry.changes.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                    {entry.changes.map((c, i) => (
                      <li key={`${entry.id}-${i}`}>
                        <span className="font-medium">{c.campo}:</span>{" "}
                        {c.de ? `${c.de} → ` : ""}
                        {c.para}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {updateMut.isPending && <Loader2 className="size-4 animate-spin" />}
          Guardar alterações
        </button>
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
          €
        </span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pl-7 text-sm outline-none focus:border-slate-900"
        />
      </div>
    </label>
  );
}