import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCheck,
  Clock,
  Loader2,
  PlayCircle,
  RefreshCw,
  UserRound,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { CHECKIN_STATUS_LABEL, checkinTime } from "@/components/checkin/checkin-presentation";
import type { CheckinStatus, FilaRow } from "@/lib/checkin.functions";

export interface QueueViewProps {
  rows: FilaRow[];
  loading: boolean;
  error: boolean;
  showAll?: boolean;
  pending: boolean;
  canAct: (row: FilaRow) => boolean;
  onStatusChange: (row: FilaRow, status: CheckinStatus) => void;
  onRetry: () => void;
  now?: number;
}

export function QueuePageView({
  count,
  refreshing,
  onRefresh,
  onBack,
  children,
}: {
  count: number | null;
  refreshing: boolean;
  onRefresh: () => void;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background pb-[calc(env(safe-area-inset-bottom)+7rem)] text-foreground sm:pb-24">
      <PageHeader
        eyebrow="Recepção"
        title="Fila do dia"
        description="Acompanhe as chegadas registradas e o atendimento."
        leading={
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onBack}
            aria-label="Voltar"
            className="rounded-xl"
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={onRefresh}
            disabled={refreshing}
            className="min-h-11 rounded-xl"
          >
            <RefreshCw
              aria-hidden="true"
              className={refreshing ? "animate-spin motion-reduce:animate-none" : undefined}
            />
            {refreshing ? "Atualizando…" : "Atualizar"}
          </Button>
        }
      />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>
            {count === null
              ? "Contagem indisponível nesta leitura"
              : `${count} ${count === 1 ? "check-in na leitura do dia" : "check-ins na leitura do dia"}`}
          </p>
          <p className="text-xs text-muted-foreground">Horários de Bruxelas</p>
        </div>
        {children}
      </main>
    </div>
  );
}

/** No arrival or completion is inferred here: controls receive the existing recorded status. */
export function QueueView({
  rows,
  loading,
  error,
  showAll = false,
  pending,
  canAct,
  onStatusChange,
  onRetry,
  now = Date.now(),
}: QueueViewProps) {
  if (loading)
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card p-10 text-sm text-muted-foreground"
      >
        <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Carregando fila…
      </div>
    );
  if (error)
    return (
      <div role="alert" className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Não foi possível carregar a fila agora.</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 min-h-11 rounded-xl"
          onClick={onRetry}
        >
          Tentar novamente
        </Button>
      </div>
    );
  if (rows.length === 0)
    return (
      <div
        role="status"
        className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center"
      >
        <UserRound aria-hidden="true" className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
        <p className="font-medium">
          {showAll ? "Nenhum check-in nesta leitura" : "Ninguém aguardando nesta leitura"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Atualize a fila para conferir novos registros.
        </p>
      </div>
    );
  return (
    <ul className="grid gap-3 xl:grid-cols-2" aria-label="Fila de atendimento">
      {rows.map((row) => {
        const arrived = Date.parse(row.arrivedAtISO);
        const waitingMinutes = Number.isFinite(arrived)
          ? Math.max(0, Math.round((now - arrived) / 60000))
          : null;
        const canChange = canAct(row);
        return (
          <li
            key={row.id}
            data-testid="fila-item"
            className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 basis-40">
                <p data-testid="fila-nome" className="break-words font-semibold">
                  {row.clienteNome}
                </p>
                <p
                  data-testid="fila-codigo"
                  className="mt-1 text-xs font-medium tracking-wide text-muted-foreground"
                >
                  {row.codigo}
                </p>
              </div>
              <StatusBadge
                variant={
                  row.status === "em_atendimento"
                    ? "info"
                    : row.status === "concluido"
                      ? "success"
                      : "neutral"
                }
                className="max-w-full whitespace-normal rounded-md text-[10px]"
              >
                {CHECKIN_STATUS_LABEL[row.status]}
              </StatusBadge>
            </div>
            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
              <QueueDetail
                label="Chegada registrada"
                value={checkinTime(row.arrivedAtISO)}
                icon={<Clock />}
              />
              <QueueDetail label="Horário agendado" value={checkinTime(row.scheduledAtISO)} />
              <QueueDetail
                label="Tatuador"
                value={row.artistId ? row.tatuador || "Nome indisponível" : "Não atribuído"}
              />
              {row.status === "aguardando" ? (
                <QueueDetail
                  label="Tempo desde a chegada"
                  value={waitingMinutes === null ? "Não informado" : `${waitingMinutes} min`}
                />
              ) : row.status === "em_atendimento" ? (
                <QueueDetail label="Atendimento iniciado" value={checkinTime(row.startedAtISO)} />
              ) : null}
            </dl>
            {row.syncStatus === "failed" ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs leading-5 text-destructive">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />A chegada
                está registrada. A sincronização com o CRM precisa de atenção.
              </p>
            ) : row.syncStatus === "pending" ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Sincronização com o CRM pendente.
              </p>
            ) : row.syncStatus === null ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Estado da sincronização não informado.
              </p>
            ) : null}
            {canChange && (row.status === "aguardando" || row.status === "em_atendimento") ? (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                {row.status === "aguardando" ? (
                  <>
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={() => onStatusChange(row, "em_atendimento")}
                      className="min-h-11 flex-1 rounded-xl"
                    >
                      <PlayCircle aria-hidden="true" />
                      Iniciar atendimento
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => onStatusChange(row, "nao_compareceu")}
                      className="min-h-11 rounded-xl"
                      aria-label={`Marcar não comparecimento de ${row.clienteNome}`}
                    >
                      <UserX aria-hidden="true" />
                      <span className="sr-only sm:not-sr-only">Não compareceu</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => onStatusChange(row, "concluido")}
                    className="min-h-11 w-full rounded-xl"
                  >
                    <CheckCheck aria-hidden="true" />
                    Concluir atendimento
                  </Button>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
function QueueDetail({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        {icon ? (
          <span aria-hidden="true" className="[&>svg]:h-3.5 [&>svg]:w-3.5">
            {icon}
          </span>
        ) : null}
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>
  );
}
