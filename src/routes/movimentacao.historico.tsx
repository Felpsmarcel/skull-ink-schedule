import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, AlertTriangle, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  listMovimentacoesHistorico,
  findMovimentacaoPage,
  getEditableMovimentacaoIds,
  type HistoricoRow,
  type MovimentacaoTipo,
} from "@/lib/movimentacao.functions";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 15;

const searchSchema = z.object({
  page: fallback(z.number().int(), 1).default(1),
  highlight: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/movimentacao/historico")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Histórico de pagamentos — GF Tattoo Studio" },
      {
        name: "description",
        content: "Histórico de registos de pagamentos do estúdio.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: HistoricoPage,
});

const TIPO_LABEL: Record<MovimentacaoTipo, string> = {
  sinal: "Sinal",
  sessao: "Sessão pagamento do dia",
  saldo: "Valor total",
  produto: "Produto GF TATTOO",
  estorno: "Estorno",
};

const currencyFmt = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function HistoricoPage() {
  const { page, highlight } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const router = useRouter();
  const fetchList = useServerFn(listMovimentacoesHistorico);
  const fetchFindPage = useServerFn(findMovimentacaoPage);
  const fetchEditableIds = useServerFn(getEditableMovimentacaoIds);

  const query = useQuery({
    queryKey: ["movimentacao-historico", page],
    queryFn: () => fetchList({ data: { page, pageSize: PAGE_SIZE } }),
    retry: false,
  });

  // Detect signed-in user (client-side) — used to gate the "Editar" button
  const [isAuthed, setIsAuthed] = useState(false);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setIsAuthed(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted) setIsAuthed(!!session?.user);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const editableQ = useQuery({
    queryKey: ["movimentacao-editable-ids", page, query.data?.rows.map((r) => r.id).join(",")],
    queryFn: () =>
      fetchEditableIds({
        data: { ids: (query.data?.rows ?? []).map((r) => r.id) },
      }),
    enabled: isAuthed && !!query.data && query.data.rows.length > 0,
    staleTime: 60_000,
  });
  const editableSet = new Set(editableQ.data?.ids ?? []);

  // Scroll to top on page change
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  // Highlight logic
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const searchedRef = useRef<string>("");

  useEffect(() => {
    if (!highlight || !query.data) return;
    const found = query.data.rows.some((r) => r.id === highlight);
    if (found) {
      setFlashId(highlight);
      // wait a tick for DOM
      const t1 = setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      const t2 = setTimeout(() => setFlashId(null), 3000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    // Not in this page — locate
    if (searchedRef.current === highlight) return;
    searchedRef.current = highlight;
    fetchFindPage({ data: { id: highlight, pageSize: PAGE_SIZE } })
      .then((res) => {
        if (res && res.page !== page) {
          toast.info(`Registo encontrado na página ${res.page}`, {
            action: {
              label: "Ir para essa página",
              onClick: () =>
                navigate({
                  search: (prev: { page: number; highlight: string }) => ({
                    ...prev,
                    page: res.page,
                    highlight,
                  }),
                }),
            },
          });
        }
      })
      .catch(() => {
        /* silencioso */
      });
  }, [highlight, query.data, page, fetchFindPage, navigate]);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      navigate({ to: "/movimentacao/$slug", params: { slug: "gabriel" } });
    }
  };

  return (
    <div className="min-h-svh bg-white pb-[calc(env(safe-area-inset-bottom)+2rem)] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-start gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="mt-0.5 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="size-4" /> Voltar
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight">Histórico de Pagamentos</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {query.data
                ? `${query.data.total} registo${query.data.total === 1 ? "" : "s"} · Total: ${currencyFmt.format(query.data.totalValor)}`
                : "\u00a0"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {query.isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-50 shadow-sm"
              />
            ))}
          </div>
        )}

        {query.isError && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-slate-700">
              Erro ao carregar registos. Tenta novamente.
            </p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="mt-3 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {query.data && query.data.rows.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Nenhum registo encontrado.
          </div>
        )}

        {query.data && query.data.rows.length > 0 && (
          <ul className="flex flex-col gap-3">
            {query.data.rows.map((row) => (
              <li key={row.id}>
                <Card
                  row={row}
                  isFlash={flashId === row.id}
                  canEdit={editableSet.has(row.id)}
                  refCallback={
                    highlight === row.id ? (el) => (highlightRef.current = el) : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}

        {query.data && query.data.total > PAGE_SIZE && (
          <Pagination
            page={page}
            total={query.data.total}
            highlight={highlight}
          />
        )}
      </main>
    </div>
  );
}

function Card({
  row,
  isFlash,
  canEdit,
  refCallback,
}: {
  row: HistoricoRow;
  isFlash: boolean;
  canEdit: boolean;
  refCallback?: (el: HTMLDivElement | null) => void;
}) {
  const isSynced = row.ghl_status === "synced";
  return (
    <div
      ref={refCallback}
      className="rounded-xl border bg-white p-4 shadow-sm transition-all duration-500"
      style={{
        borderColor: isFlash ? "#E11D2A" : undefined,
        borderWidth: isFlash ? 2 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs text-slate-500">{formatDateTime(row.created_at)}</span>
        <span
          className={
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium " +
            (isSynced
              ? "bg-green-50 text-green-700"
              : "bg-amber-50 text-amber-700")
          }
        >
          {isSynced ? (
            <>
              <CheckCircle2 className="size-3" /> Sync
            </>
          ) : (
            <>
              <AlertTriangle className="size-3" /> Pendente
            </>
          )}
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-slate-900">
            {row.nome_cliente}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            Tatuador: {row.tatuador ?? "—"}
          </p>
          <p className="mt-1 truncate text-xs text-slate-600">
            {TIPO_LABEL[row.tipo_movimento]} · {row.metodo}
          </p>
        </div>
        <span className="shrink-0 text-base font-bold" style={{ color: "#16a34a" }}>
          {currencyFmt.format(row.total)}
        </span>
      </div>
      {canEdit && (
        <div className="mt-3 flex justify-end">
          <Link
            to="/movimentacao/historico/$id/editar"
            params={{ id: row.id }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="size-3" /> Editar
          </Link>
        </div>
      )}
    </div>
  );
}

function Pagination({
  page,
  total,
  highlight,
}: {
  page: number;
  total: number;
  highlight: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      {hasPrev ? (
        <Link
          to="/movimentacao/historico"
          search={{ page: page - 1, highlight }}
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          ← Anterior
        </Link>
      ) : (
        <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-300">
          ← Anterior
        </span>
      )}
      <span className="text-xs text-slate-500">
        Página {page} de {totalPages}
      </span>
      {hasNext ? (
        <Link
          to="/movimentacao/historico"
          search={{ page: page + 1, highlight }}
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Próximo →
        </Link>
      ) : (
        <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-300">
          Próximo →
        </span>
      )}
    </div>
  );
}