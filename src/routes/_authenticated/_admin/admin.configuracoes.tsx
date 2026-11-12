import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import {
  checkPaymentMirrorConnection,
  type PaymentMirrorConnectionResult,
} from "@/lib/payment-mirror-connection.functions";
import {
  confirmReceipt,
  getPaymentMirrorStatus,
  getReceiptCandidates,
  type ReceiptCandidate,
} from "@/lib/payment-mirror.functions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/_admin/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — GF Tattoo Studio" },
      { name: "description", content: "Integrações e pendências administrativas do estúdio." },
      { property: "og:title", content: "Configurações — GF Tattoo Studio" },
      {
        property: "og:description",
        content: "Integrações e pendências administrativas do estúdio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Configuracoes,
});

const GATE_LABEL: Record<string, string> = {
  flag: "Interruptor do servidor",
  scopesVerified: "Permissões do token do CRM (faturas e pagamentos) comprovadas",
  contractVerified: "Formato de envio homologado (teste EUR 1,23)",
  workflowsReviewed: "Automações 'Payment Received' conferidas",
  draftHomologated: "Pagamento em fatura não enviada homologado",
};
const SOURCE_LABEL = { payment: "Pagamento da agenda", movimentacao: "Movimentação" } as const;
const METHOD_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  dinheiro: "Dinheiro",
  card: "Cartão",
  cartao: "Cartão",
  sumup: "SumUp",
  transfer: "Transferência",
  transferencia: "Transferência",
  payconiq: "Payconiq",
  other: "Outra forma",
};
const REASON_LABEL: Record<string, string> = {
  desligado: "A integração está em preparação.",
  projeto_ausente: "Projeto por vincular",
  contato_ausente: "Cliente por vincular ao CRM",
  contato_divergente: "Cliente e projeto divergentes",
  projeto_divergente: "O projeto foi alterado; atualize a fila.",
  valor_invalido: "Valor recebido por corrigir",
  data_ausente: "Data do recebimento por preencher",
  confirmacao_inconsistente: "Confirmação por conciliar",
  rejeitado: "Recebimento rejeitado",
  conflito_idempotencia: "Recebimento por conciliar",
  conflito_mapeamento: "Vínculo por conciliar",
};
const MIRROR_LABEL: Record<string, string> = {
  pending: "Na fila do CRM",
  fatura_a_conciliar: "Fatura por conciliar",
  pagamento_a_conciliar: "Pagamento por conciliar",
  revisao: "Revisão necessária",
  concluido: "Registrado no CRM",
};
const money = (cents: number | null) =>
  cents === null
    ? "Valor por corrigir"
    : new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);
const civilDate = (date: string | null) =>
  date ? date.split("-").reverse().join("/") : "Data por preencher";
function recentPeriod() {
  const to = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const from = new Date(`${to}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: from.toISOString().slice(0, 10), to, includeHistorical: false };
}

function Configuracoes() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getPaymentMirrorStatus);
  const fetchCandidates = useServerFn(getReceiptCandidates);
  const confirmFn = useServerFn(confirmReceipt);
  const q = useQuery({ queryKey: ["payment-mirror-status"], queryFn: () => fetchStatus() });
  const active = q.data?.state === "ativo";
  const [period, setPeriod] = useState(recentPeriod);
  const [draft, setDraft] = useState(period);
  const [selected, setSelected] = useState<ReceiptCandidate | null>(null);
  const [historicalAcknowledged, setHistoricalAcknowledged] = useState(false);
  const candidates = useQuery({
    queryKey: ["payment-mirror-candidates", period],
    queryFn: () => fetchCandidates({ data: { ...period, limit: 100 } }),
    enabled: active,
  });
  const historical = selected?.paidOn ? selected.paidOn < recentPeriod().from : false;
  const m = useMutation({
    mutationFn: (row: ReceiptCandidate) =>
      confirmFn({
        data: {
          source: row.source,
          sourceId: row.sourceId,
          expectedProjectId: row.projectId ?? undefined,
        },
      }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("Recebimento confirmado. Envio ao CRM na fila.");
        setSelected(null);
        qc.invalidateQueries({ queryKey: ["payment-mirror-status"] });
        qc.invalidateQueries({ queryKey: ["payment-mirror-candidates"] });
      } else
        toast.error(
          REASON_LABEL[r.reason ?? ""] ??
            "Não foi possível confirmar. Atualize a fila e confira o vínculo.",
        );
    },
    onError: () =>
      toast.error("Não foi possível confirmar. Atualize a fila antes de tentar novamente."),
  });

  return (
    <div className="min-h-dvh bg-background pb-24 text-foreground">
      <PageHeader
        title="Recebimentos e integração"
        description="Preparação da conexão com o CRM e conferência de recebimentos."
        leading={
          <Button asChild variant="outline" size="icon" className="min-h-11 min-w-11 rounded-xl">
            <Link to="/menu" aria-label="Voltar para conta e gestão"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
        }
      />
      <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Recebimentos nas faturas do CRM</h2>
          {q.data && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {active ? "Ativo" : "Em preparação"}
            </span>
          )}
        </div>
        {q.isLoading && <Skeleton className="h-24 w-full" />}
        {q.isError && (
          <ErrorState
            title="Não foi possível carregar"
            description="Tente novamente."
            onRetry={() => q.refetch()}
          />
        )}
        {q.data && (
          <>
            <p className="text-sm text-muted-foreground">
              Uma fatura por projeto, sem envio ao cliente. Confirme somente o valor realmente
              recebido; esta ação não registra repasse ao artista.
            </p>
            {!active && (
              <p className="rounded-md bg-muted p-3 text-sm">
                Em preparação. A fila e as confirmações ficam bloqueadas até a homologação e
                ativação da integração.
              </p>
            )}
            <details className="rounded-md border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Preparação e pendências da integração
              </summary>
              <ul className="mt-3 space-y-2 text-sm">
                {Object.entries(q.data.gates).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-3">
                    <span className="min-w-0 break-words">{GATE_LABEL[k]}</span>
                    <span className={`shrink-0 ${v ? "text-primary" : "text-muted-foreground"}`}>
                      {v ? "OK" : "Pendente"}
                    </span>
                  </li>
                ))}
              </ul>
              {active && q.data.pendingReasons.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {q.data.pendingReasons.map((p) => (
                    <li key={`${p.state}-${p.reason}`} className="flex justify-between gap-2">
                      <span>
                        {MIRROR_LABEL[p.state] ?? "Revisão necessária"} ·{" "}
                        {REASON_LABEL[p.reason] ?? "Conferir integração"}
                      </span>
                      <span>{p.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </>
        )}
      </section>

      <VerificarConexaoGhl />

      {active && (
        <section className="space-y-4" aria-labelledby="receipt-queue-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="receipt-queue-title" className="font-semibold">
              Conferir recebimentos
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => candidates.refetch()}
              disabled={candidates.isFetching || m.isPending}
            >
              Atualizar fila
            </Button>
          </div>
          <form
            className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5"
            onSubmit={(event) => {
              event.preventDefault();
              setSelected(null);
              setPeriod({ ...draft });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="min-w-0 space-y-1 text-sm">
                Recebido de
                <input
                  type="date"
                  required
                  value={draft.from}
                  max={draft.to}
                  onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                  className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3"
                />
              </label>
              <label className="min-w-0 space-y-1 text-sm">
                Recebido até
                <input
                  type="date"
                  required
                  value={draft.to}
                  min={draft.from}
                  max={recentPeriod().to}
                  onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                  className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3"
                />
              </label>
              <Button
                type="submit"
                className="min-h-11 self-end"
                disabled={candidates.isFetching || m.isPending}
              >
                Consultar período
              </Button>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.includeHistorical}
                onChange={(e) => setDraft({ ...draft, includeHistorical: e.target.checked })}
                className="mt-1"
              />
              Consultar também recebimentos anteriores aos últimos 30 dias
            </label>
            <p className="text-xs text-muted-foreground">
              Até 100 recebimentos por consulta, em ordem de data. Consultar não confirma nem envia
              lançamentos antigos.
            </p>
          </form>
          {candidates.isLoading && <Skeleton className="h-36 w-full" />}
          {candidates.isError && (
            <ErrorState
              title="Não foi possível carregar a fila"
              description="Confira as datas e autorize a consulta de antigos quando necessário. O período máximo é de 366 dias."
              onRetry={() => candidates.refetch()}
            />
          )}
          {candidates.data?.state === "preparacao" && (
            <p className="text-sm text-muted-foreground">
              A integração voltou para preparação. Nenhum recebimento foi confirmado.
            </p>
          )}
          {candidates.data?.state === "ativo" && (
            <>
              <p className="text-sm text-muted-foreground">
                Recebimentos de {civilDate(candidates.data.from)} a {civilDate(candidates.data.to)}{" "}
                · {candidates.data.rows.length} exibido(s)
                {candidates.data.limitReached
                  ? " · limite atingido; reduza o período para conferir os demais"
                  : ""}
              </p>
              {candidates.data.rows.length === 0 && (
                <p className="rounded-lg border border-border p-4 text-sm">
                  Nenhum recebimento encontrado neste período.
                </p>
              )}
              <ul className="space-y-3">
                {candidates.data.rows.map((row) => {
                  const canConfirm =
                    row.confirmationStatus === "informado" &&
                    !row.blockReason &&
                    row.projectId !== null;
                  const needsLink =
                    row.blockReason === "projeto_ausente" ||
                    row.blockReason === "contato_ausente" ||
                    row.blockReason === "contato_divergente";
                  return (
                    <li
                      key={`${row.source}:${row.sourceId}`}
                      className="min-w-0 space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words font-medium">{row.clientName}</h3>
                          <p className="break-words text-sm text-muted-foreground">
                            {row.projectTitle}
                          </p>
                        </div>
                        <p className="font-semibold tabular-nums">{money(row.amountCents)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Valor integral deste recebimento · {civilDate(row.paidOn)} ·{" "}
                        {METHOD_LABEL[row.method] ?? "Forma a conferir"} ·{" "}
                        {SOURCE_LABEL[row.source]}
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm">
                          {row.blockReason
                            ? (REASON_LABEL[row.blockReason] ?? "Conferir recebimento")
                            : row.confirmationStatus === "confirmado"
                              ? (MIRROR_LABEL[row.mirrorState ?? ""] ??
                                "Confirmado · envio por conferir")
                              : "Informado · aguardando confirmação"}
                        </p>
                        {canConfirm && (
                          <Button
                            className="min-h-11"
                            disabled={m.isPending}
                            onClick={() => {
                              setSelected(row);
                              setHistoricalAcknowledged(false);
                            }}
                          >
                            Confirmar
                          </Button>
                        )}
                        {(needsLink ||
                          row.mirrorState === "revisao" ||
                          row.mirrorState === "fatura_a_conciliar" ||
                          row.mirrorState === "pagamento_a_conciliar") && (
                          <Button variant="outline" asChild className="min-h-11">
                            <Link to="/reconciliar">Resolver vínculo</Link>
                          </Button>
                        )}
                      </div>
                      {row.possibleDuplicate && (
                        <p className="text-xs text-muted-foreground">
                          Existe outro lançamento com cliente, projeto, data e valor iguais. Confira
                          se é outra parcela ou o mesmo recebimento antes de confirmar.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}

      </main>

      <AlertDialog
        open={active && selected !== null}
        onOpenChange={(open) => {
          if (!open && !m.isPending) setSelected(null);
        }}
      >
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar recebimento</AlertDialogTitle>
            <AlertDialogDescription>
              Confira o cliente, projeto e parcela. A confirmação coloca este recebimento na fila do
              CRM; não envia a fatura ao cliente nem registra comissão paga.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <p className="break-words font-medium">
                {selected.clientName} · {selected.projectTitle}
              </p>
              <p>
                {civilDate(selected.paidOn)} · {money(selected.amountCents)} ·{" "}
                {METHOD_LABEL[selected.method] ?? "Forma a conferir"}
              </p>
              {selected.possibleDuplicate && (
                <p className="rounded-md bg-muted p-3">
                  Há outro lançamento semelhante. Confirme somente se este representa um recebimento
                  distinto.
                </p>
              )}
              {historical && (
                <label className="flex items-start gap-2 rounded-md border border-border p-3">
                  <input
                    type="checkbox"
                    checked={historicalAcknowledged}
                    onChange={(e) => setHistoricalAcknowledged(e.target.checked)}
                    className="mt-1"
                  />
                  Quero confirmar individualmente este recebimento antigo e colocá-lo na fila do
                  CRM.
                </label>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.isPending}>Voltar</AlertDialogCancel>
            <Button
              disabled={
                !active || !selected || m.isPending || (historical && !historicalAcknowledged)
              }
              onClick={() => {
                if (selected && (!historical || historicalAcknowledged)) m.mutate(selected);
              }}
            >
              {m.isPending ? "Confirmando..." : "Confirmar e colocar na fila"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const CONNECTION_CHECK_LABELS = [
  ["calendar", "Calendário da GF"],
  ["invoices", "Consulta de faturas"],
  ["transactions", "Consulta de transações"],
] as const;
const CONNECTION_REASON_LABEL: Record<string, string> = {
  token_ausente: "Credencial do servidor ainda não configurada.",
  calendario_ausente: "Calendário de conferência ainda não configurado.",
  consulta_calendario_falhou: "Não foi possível conferir o calendário.",
  calendario_divergente: "O calendário precisa de conferência.",
  resposta_invalida: "A resposta recebida precisa de revisão.",
  nao_autorizado: "A credencial não foi autorizada.",
  sem_permissao: "Permissão de leitura não concedida.",
  limite_temporario: "Limite temporário de consultas. Tente mais tarde.",
  http_falhou: "O GHL não concluiu a consulta.",
  timeout: "A consulta demorou além do limite.",
  rede_indisponivel: "Não foi possível acessar o GHL.",
  verificacao_calendario_pendente: "A consulta aguarda a conferência do calendário.",
};
function connectionCheckedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Horário indisponível"
    : new Intl.DateTimeFormat("pt-PT", {
        timeZone: "Europe/Brussels",
        dateStyle: "short",
        timeStyle: "medium",
      }).format(date);
}
function VerificarConexaoGhl() {
  const checkFn = useServerFn(checkPaymentMirrorConnection);
  const check = useMutation<PaymentMirrorConnectionResult>({
    mutationFn: () => checkFn(),
    retry: false,
  });
  const results = check.data;
  return (
    <section
      className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="connection-check-title"
      aria-busy={check.isPending}
    >
      <h2 id="connection-check-title" className="font-medium">
        Conexão de leitura com o GHL
      </h2>
      <p className="text-sm text-muted-foreground">
        Consulta apenas; não cria faturas ou pagamentos.
      </p>
      <Button
        type="button"
        className="min-h-11 w-full sm:w-auto"
        disabled={check.isPending}
        onClick={() => check.mutate()}
      >
        {check.isPending ? "Verificando conexão..." : "Verificar conexão com o GHL"}
      </Button>
      <div className="space-y-3" aria-live="polite">
        {check.isPending && (
          <p className="text-sm text-muted-foreground">Consultando o GHL. Aguarde o resultado.</p>
        )}
        {check.isError && (
          <p className="text-sm text-destructive">
            Não foi possível verificar a conexão. Tente novamente.
          </p>
        )}
        {results && !check.isPending && !check.isError && (
          <>
            <p className="text-sm text-muted-foreground">
              Credencial no servidor: {results.tokenConfigured ? "configurada" : "não configurada"}.
            </p>
            <ul className="divide-y divide-border">
              {CONNECTION_CHECK_LABELS.map(([key, label]) => {
                const result = results[key];
                return (
                  <li key={key} className="space-y-1 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                      <span className="font-medium">{label}</span>
                      <span
                        className={
                          result.state === "ok"
                            ? "text-primary"
                            : result.state === "erro"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }
                      >
                        {result.state === "ok"
                          ? "Leitura autorizada"
                          : result.state === "erro"
                            ? "Falha na consulta"
                            : "Não testado"}
                        {result.status !== null && ` · HTTP ${result.status}`}
                      </span>
                    </div>
                    {result.reason && (
                      <p className="text-xs text-muted-foreground">
                        {CONNECTION_REASON_LABEL[result.reason] ??
                          "A consulta precisa de conferência."}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="text-sm">
              {results.readAccessVerified
                ? "Leitura conferida. Esta verificação não ativa nem altera a sincronização."
                : "Leitura ainda não conferida. Esta verificação não ativa nem altera a sincronização."}
            </p>
            <p className="text-xs text-muted-foreground">
              Esta consulta não comprova permissão de escrita nem identifica o titular da
              credencial.
            </p>
            <p className="text-xs text-muted-foreground">
              Verificado em {connectionCheckedAt(results.checkedAt)} · Bruxelas
            </p>
          </>
        )}
      </div>
    </section>
  );
}
