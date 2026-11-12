import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Lock,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge, bucketLabel, bucketToVariant } from "@/components/ui/status-badge";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type {
  AdminAppointmentRow,
  AdminSummary,
  ArtistAppointmentRow,
  ArtistSummary,
  PaymentBucket,
  SellerSummary,
} from "@/lib/finance.functions";

export type FinancePeriod = "today" | "week" | "month" | "all";
export type FinanceBucketFilter = "all" | PaymentBucket;
export interface FinanceFilters {
  period: FinancePeriod;
  bucket: FinanceBucketFilter;
  artist: string;
  seller: string;
}
export type FinanceViewModel =
  | { role: "admin"; data: AdminSummary; rows: AdminAppointmentRow[] }
  | { role: "artist"; data: ArtistSummary; rows: ArtistAppointmentRow[] }
  | { role: "seller"; data: SellerSummary; rows: ArtistAppointmentRow[] };

export interface FinanceViewProps {
  model: FinanceViewModel | null;
  filters: FinanceFilters;
  isLoading: boolean;
  error?: string | null;
  onRetry: () => void;
  onBack: () => void;
  onFiltersChange: (patch: Partial<FinanceFilters>) => void;
  actions?: ReactNode;
}

/** Presentation only: identity, queries, row filtering and navigation remain in the route. */
export function FinanceView({
  model,
  filters,
  isLoading,
  error,
  onRetry,
  onBack,
  onFiltersChange,
  actions,
}: FinanceViewProps) {
  const hasFilters = Object.values(filters).some((value) => value !== "all");
  return (
    <div className="min-h-dvh bg-background pb-[calc(env(safe-area-inset-bottom)+6rem)] sm:pb-20">
      <PageHeader
        eyebrow="GF Tattoo Studio"
        title="Financeiro"
        description="Acompanhe os valores dos seus agendamentos."
        leading={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-xl"
            onClick={onBack}
            aria-label="Voltar para a agenda"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
        }
        actions={actions}
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 pt-5 sm:px-6 sm:pt-6">
        {isLoading ? (
          <div role="status" className="rounded-2xl border border-border bg-card p-6">
            <LoadingState label="Carregando seus valores…" />
          </div>
        ) : error !== null && error !== undefined ? (
          <ErrorState
            description="Não foi possível carregar o financeiro."
            details={error}
            onRetry={onRetry}
            className="rounded-2xl"
          />
        ) : !model ? (
          <EmptyState
            title="Financeiro indisponível"
            description="Não há dados disponíveis nesta leitura."
          />
        ) : (
          <>
            <section aria-labelledby="finance-summary-heading" className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 id="finance-summary-heading" className="font-display text-lg font-semibold">
                    {model.role === "admin" ? "Resumo da leitura" : "Minha comissão"}
                  </h2>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                    Valores retornados pelo sistema para o seu acesso. Os filtros alteram apenas a
                    lista abaixo.
                  </p>
                </div>
                <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                  EUR · Euro
                </span>
              </div>
              <SummaryCards model={model} />
              <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs leading-5 text-muted-foreground">
                {model.role === "artist"
                  ? "Você vê somente a sua comissão. "
                  : model.role === "seller"
                    ? "Você vê somente a sua comissão como vendedor. "
                    : "Comissões exibidas conforme os registros disponíveis. "}
                A aplicação da regra por data de realização ainda aguarda validação. Os status
                refletem a classificação do sistema; recebimentos e repasses precisam ser
                conferidos.
              </p>
            </section>

            <section
              aria-label="Filtrar lançamentos"
              className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
            >
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-primary" />
                Filtrar a lista
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <FilterRow
                  label="Período"
                  value={filters.period}
                  onChange={(period) => onFiltersChange({ period })}
                  options={[
                    { value: "today", label: "Hoje" },
                    { value: "week", label: "Semana" },
                    { value: "month", label: "Mês" },
                    { value: "all", label: "Todos" },
                  ]}
                />
                <FilterRow
                  label="Status do pagamento"
                  value={filters.bucket}
                  onChange={(bucket) => onFiltersChange({ bucket })}
                  options={[
                    { value: "all", label: "Todos" },
                    { value: "pago", label: "Pago" },
                    { value: "pendente", label: "Pendente" },
                    { value: "a_receber", label: "A receber" },
                  ]}
                />
                {model.role === "admin" ? (
                  <>
                    <FilterSelect
                      label="Tatuador"
                      value={filters.artist}
                      onChange={(artist) => onFiltersChange({ artist })}
                    >
                      <option value="all">Todos os tatuadores</option>
                      {model.data.artists.map((artist) => (
                        <option key={artist.id} value={artist.id}>
                          {artist.name}
                        </option>
                      ))}
                    </FilterSelect>
                    <FilterSelect
                      label="Vendedor"
                      value={filters.seller}
                      onChange={(seller) => onFiltersChange({ seller })}
                    >
                      <option value="all">Todos os vendedores</option>
                      <option value="none">Sem vendedor</option>
                      {model.data.sellers.map((seller) => (
                        <option key={seller.id} value={seller.id}>
                          {seller.name}
                        </option>
                      ))}
                    </FilterSelect>
                  </>
                ) : null}
              </div>
              {hasFilters ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                  <p className="text-xs text-muted-foreground">
                    Filtros aplicados à lista de agendamentos.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 rounded-lg text-xs"
                    onClick={() =>
                      onFiltersChange({
                        period: "all",
                        bucket: "all",
                        artist: "all",
                        seller: "all",
                      })
                    }
                  >
                    Limpar filtros
                  </Button>
                </div>
              ) : null}
            </section>

            <section aria-labelledby="finance-records-heading" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="finance-records-heading" className="font-display text-lg font-semibold">
                  Agendamentos
                </h2>
                <p aria-live="polite" className="text-xs text-muted-foreground">
                  {model.rows.length}{" "}
                  {model.rows.length === 1 ? "registro na lista" : "registros na lista"}
                </p>
              </div>
              {model.rows.length === 0 ? (
                <EmptyState
                  title={hasFilters ? "Nenhum resultado" : "Nenhum agendamento"}
                  description={
                    hasFilters
                      ? "Não há agendamentos com os filtros aplicados."
                      : "Os agendamentos aparecerão aqui quando estiverem disponíveis."
                  }
                />
              ) : model.role === "admin" ? (
                <AdminRecords rows={model.rows} />
              ) : (
                <ScopedRecords rows={model.rows} />
              )}
              <p className="text-xs text-muted-foreground">
                Datas e horários exibidos em Bruxelas.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function SummaryCards({ model }: { model: FinanceViewModel }) {
  return (
    <>
      {model.role === "admin" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="Total bruto"
            value={model.data.totalBruto}
            icon={<Wallet className="h-4 w-4" />}
            prominent
          />
          <Metric label="Comissão dos tatuadores" value={model.data.comissaoTotal} />
          <Metric label="Parte do estúdio" value={model.data.estudioTotal} />
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Pago"
          value={model.data.pago}
          tone="good"
          icon={<Check className="h-4 w-4" />}
        />
        <Metric
          label="Pendente"
          value={model.data.pendente}
          tone="warn"
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
        <Metric
          label="A receber"
          value={model.data.aReceber}
          icon={<ArrowDownLeft className="h-4 w-4" />}
        />
      </div>
      {model.role === "admin" && model.data.vendedorComissaoTotal > 0 ? (
        <Metric label="Comissão dos vendedores" value={model.data.vendedorComissaoTotal} />
      ) : null}
    </>
  );
}

function money(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? formatCurrency(value)
    : "Não informado";
}

function Metric({
  label,
  value,
  tone,
  prominent = false,
  icon,
}: {
  label: string;
  value: number | null;
  tone?: "good" | "warn";
  prominent?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border p-4 shadow-sm sm:p-5 ${prominent ? "border-primary/30 bg-accent/50" : "border-border bg-card"}`}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:items-start">
        <div className="flex items-center gap-2">
          {icon ? (
            <span
              aria-hidden="true"
              className={
                tone === "good" ? "text-success" : tone === "warn" ? "text-warning" : "text-primary"
              }
            >
              {icon}
            </span>
          ) : null}
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
        </div>
        <p className="break-words font-display text-2xl font-bold tabular-nums sm:mt-4 sm:w-full">
          {money(value)}
        </p>
      </div>
    </div>
  );
}

function FilterRow<V extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: V;
  onChange: (value: V) => void;
  options: readonly { value: V; label: string }[];
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div
        role="group"
        aria-label={label}
        className="grid grid-cols-4 gap-1 rounded-xl bg-muted/60 p-1"
      >
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={option.value === value ? "default" : "ghost"}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className="h-auto min-h-11 min-w-0 whitespace-normal rounded-lg px-1 py-2 text-xs"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 min-w-0 max-w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </select>
    </label>
  );
}

function PaymentStatus({ row }: { row: ArtistAppointmentRow }) {
  return (
    <StatusBadge variant={bucketToVariant(row.bucket)} className="shrink-0 rounded-md text-[10px]">
      {row.manualOverride ? (
        <>
          <Lock aria-hidden="true" className="h-3 w-3" />
          <span className="sr-only">Status definido manualmente. </span>
        </>
      ) : null}
      {bucketLabel(row.bucket)}
    </StatusBadge>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center"
    >
      <Wallet aria-hidden="true" className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function AppointmentHeading({ row }: { row: ArtistAppointmentRow }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 basis-36">
        <p className="break-words text-sm font-semibold">
          {row.contactName || "Cliente não informado"}
        </p>
        {row.servicesSummary ? (
          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
            {row.servicesSummary}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(row.startAt)}</p>
      </div>
      <PaymentStatus row={row} />
    </div>
  );
}

function ScopedRecords({ rows }: { rows: ArtistAppointmentRow[] }) {
  return (
    <>
      <ul className="grid gap-3 sm:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <AppointmentHeading row={row} />
            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">Minha comissão</span>
              <strong className="text-lg tabular-nums">{money(row.commissionEur)}</strong>
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card sm:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Comissões dos agendamentos visíveis na lista</caption>
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-4 font-medium">Cliente / Serviço</th>
              <th className="px-4 py-4 font-medium">Data</th>
              <th className="px-4 py-4 text-right font-medium">Minha comissão</th>
              <th className="px-4 py-4 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                <td className="max-w-sm px-4 py-4">
                  <p className="break-words font-medium">
                    {row.contactName || "Cliente não informado"}
                  </p>
                  <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                    {row.servicesSummary}
                  </p>
                </td>
                <td className="px-4 py-4 text-xs text-muted-foreground">
                  {formatDateTime(row.startAt)}
                </td>
                <td className="px-4 py-4 text-right font-semibold tabular-nums">
                  {money(row.commissionEur)}
                </td>
                <td className="px-4 py-4 text-right">
                  <PaymentStatus row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function assignmentName(id: string | null | undefined, name: string | null) {
  if (!id) return "Não atribuído";
  return name?.trim() ? name : "Nome indisponível";
}

function AdminRecords({ rows }: { rows: AdminAppointmentRow[] }) {
  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <AppointmentHeading row={row} />
            <dl className="mt-4 grid grid-cols-3 gap-x-2 gap-y-3 border-t border-border pt-3">
              <RowAmount label="Total" value={row.totalEur} />
              <RowAmount label="Comissão" value={row.commissionEur} />
              <RowAmount label="Estúdio" value={row.studioEur} />
            </dl>
            <div className="mt-4 space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <p className="break-words">
                Tatuador · {assignmentName(row.artistId, row.artistName)}
              </p>
              {row.sellerId ? (
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="break-words">
                    Vendedor · {assignmentName(row.sellerId, row.sellerName)}
                  </span>
                  <strong className="text-foreground tabular-nums">
                    {money(row.sellerCommissionEur)}
                  </strong>
                </p>
              ) : (
                <p>Vendedor · Não atribuído</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card xl:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Valores administrativos dos agendamentos visíveis na lista
          </caption>
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-4 font-medium">Cliente / Serviço</th>
              <th className="px-3 py-4 font-medium">Data / Tatuador</th>
              <th className="px-3 py-4 text-right font-medium">Total</th>
              <th className="px-3 py-4 text-right font-medium">Comissão</th>
              <th className="px-3 py-4 text-right font-medium">Estúdio</th>
              <th className="px-3 py-4 font-medium">Vendedor</th>
              <th className="px-4 py-4 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                <td className="max-w-60 px-4 py-4">
                  <p className="break-words font-medium">
                    {row.contactName ?? "Cliente não informado"}
                  </p>
                  <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                    {row.servicesSummary}
                  </p>
                </td>
                <td className="px-3 py-4 text-xs text-muted-foreground">
                  <p>{formatDateTime(row.startAt)}</p>
                  <p className="mt-2 max-w-36 break-words">
                    {assignmentName(row.artistId, row.artistName)}
                  </p>
                </td>
                <td className="px-3 py-4 text-right tabular-nums">{money(row.totalEur)}</td>
                <td className="px-3 py-4 text-right tabular-nums">{money(row.commissionEur)}</td>
                <td className="px-3 py-4 text-right tabular-nums">{money(row.studioEur)}</td>
                <td className="max-w-36 px-3 py-4">
                  <p className="break-words text-xs text-muted-foreground">
                    {assignmentName(row.sellerId, row.sellerName)}
                  </p>
                  {row.sellerId ? (
                    <p className="mt-2 text-xs tabular-nums">{money(row.sellerCommissionEur)}</p>
                  ) : null}
                </td>
                <td className="px-4 py-4 text-right">
                  <PaymentStatus row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RowAmount({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold tabular-nums">{money(value)}</dd>
    </div>
  );
}
