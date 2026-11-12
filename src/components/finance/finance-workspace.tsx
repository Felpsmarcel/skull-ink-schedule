import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  FolderOpen,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { buildFinanceWorkspace } from "@/lib/finance-workspace-core";
import type {
  FinanceArea,
  FinanceWorkspaceData,
  WorkspaceFilters,
  WorkspaceMetric,
} from "@/lib/finance-workspace-types";

const AREAS = [
  {
    id: "projects",
    title: "Vendas e projetos",
    icon: FolderOpen,
    subtitle: "Carteira e oportunidades",
  },
  { id: "receipts", title: "Recebimentos", icon: ArrowDownLeft, subtitle: "Entradas e estornos" },
  {
    id: "sessions",
    title: "Sessões e comissões",
    icon: CalendarDays,
    subtitle: "Execução e estimativas",
  },
  { id: "payouts", title: "Repasses", icon: ArrowUpRight, subtitle: "Apuração e pagamentos" },
] as const;
const COPY: Record<FinanceArea, { title: string; description: string; date: string }> = {
  projects: {
    title: "Sua carteira de projetos",
    description: "Um projeto reúne as sessões e mantém seu orçamento separado dos recebimentos.",
    date: "Data de cadastro do projeto",
  },
  receipts: {
    title: "Dinheiro registrado no estúdio",
    description:
      "Sinais, sessões, saldos e produtos lançados no app. Estornos são descontados uma vez.",
    date: "Data do pagamento informado",
  },
  sessions: {
    title: "Sessões e previsão de comissão",
    description:
      "Valores cadastrados por agendamento. A realização e o repasse são conferências separadas.",
    date: "Data agendada da sessão",
  },
  payouts: {
    title: "Do trabalho realizado ao repasse",
    description: "Acompanhe separadamente o que foi apurado, aprovado e pago à equipe.",
    date: "Data do repasse",
  },
};
const inputClass =
  "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const actionClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const statusNames: Record<string, string> = {
  lead: "Em avaliação",
  quoted: "Orçado",
  scheduled: "Agendado",
  in_progress: "Em andamento",
  completed: "Concluído no cadastro",
  cancelled: "Cancelado",
  confirmed: "Confirmado",
  pending: "Pendente",
  no_show: "Não compareceu",
  sinal: "Sinal",
  sessao: "Sessão",
  saldo: "Saldo",
  produto: "Produto",
  estorno: "Estorno",
};
function money(cents: number | null | undefined) {
  return cents == null ? "A apurar" : formatCurrency(cents / 100);
}
function dateLabel(date: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date.split("-").reverse().join("/");
  return Number.isFinite(Date.parse(date)) ? formatDateTime(date) : "Data a conferir";
}
export interface FinanceWorkspaceProps {
  data?: FinanceWorkspaceData;
  filters: WorkspaceFilters;
  loading: boolean;
  fetching: boolean;
  error: boolean;
  onChange: (patch: Partial<WorkspaceFilters>) => void;
  onRefresh: () => void;
  now?: Date;
}
export function FinanceWorkspace({
  data,
  filters,
  loading,
  fetching,
  error,
  onChange,
  onRefresh,
  now,
}: FinanceWorkspaceProps) {
  const model = data ? buildFinanceWorkspace(data, filters, now) : null;
  const isAdmin = data?.role === "admin";
  const areas = isAdmin ? AREAS : AREAS.filter((a) => a.id === "sessions" || a.id === "payouts");
  const area = model?.area ?? filters.area;
  const copy = COPY[area];
  return (
    <div className="min-h-dvh bg-background pb-28">
      <PageHeader
        eyebrow="GF Tattoo Studio"
        title={data && !isAdmin ? "Meu financeiro" : "Financeiro"}
        description="Clareza em cada etapa, do projeto ao repasse."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-11 rounded-xl"
              onClick={onRefresh}
              disabled={fetching || loading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${fetching ? "motion-safe:animate-spin" : ""}`}
                aria-hidden="true"
              />
              {fetching ? "Atualizando…" : "Atualizar leitura"}
            </Button>
            {isAdmin && (
              <Link to="/relatorios/movimentacoes" className={actionClass}>
                Ver lançamentos
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        }
      />
      <main className="mx-auto max-w-7xl space-y-6 px-4 pt-5 sm:px-6 sm:pt-7">
        {loading && !data ? (
          <div
            role="status"
            className="rounded-2xl border border-border bg-card p-8 text-muted-foreground"
          >
            Carregando o financeiro…
          </div>
        ) : !data ? (
          <div role="alert" className="rounded-2xl border border-border bg-card p-8">
            <h2 className="font-semibold">Leitura indisponível</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Não foi possível verificar os valores para seu acesso.
            </p>
            <Button variant="outline" className="mt-4" onClick={onRefresh}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm"
              >
                A atualização falhou. Exibindo a última leitura, de {dateLabel(data.updatedAt)}.
              </p>
            )}
            <nav
              aria-label="Visões do financeiro"
              className={`grid gap-2 ${isAdmin ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2"}`}
            >
              {areas.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={area === item.id}
                  onClick={() => onChange({ area: item.id })}
                  className={`flex min-w-0 items-start gap-3 rounded-2xl border p-3 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4 ${area === item.id ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card hover:bg-accent/40"}`}
                >
                  <item.icon
                    className="mt-0.5 hidden h-5 w-5 shrink-0 sm:block"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span
                      className={`mt-1 block text-xs leading-5 ${area === item.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                    >
                      {item.subtitle}
                    </span>
                  </span>
                </button>
              ))}
            </nav>
            <section
              aria-label="Filtros do financeiro"
              className="rounded-2xl border border-border bg-card p-4 sm:p-5"
            >
              <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-2 text-xs font-medium text-muted-foreground">
                  Período
                  <select
                    aria-label="Período"
                    className={inputClass}
                    value={filters.period}
                    onChange={(e) =>
                      onChange({ period: e.target.value as WorkspaceFilters["period"] })
                    }
                  >
                    <option value="today">Hoje</option>
                    <option value="week">Esta semana</option>
                    <option value="month">Este mês</option>
                    <option value="all">Todo o histórico disponível</option>
                    <option value="custom">Escolher datas</option>
                  </select>
                </label>
                {isAdmin && (
                  <label className="space-y-2 text-xs font-medium text-muted-foreground">
                    Tatuador
                    <select
                      aria-label="Tatuador"
                      className={inputClass}
                      value={filters.artist}
                      onChange={(e) => onChange({ artist: e.target.value })}
                    >
                      <option value="all">Todos os tatuadores</option>
                      {data.artists.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {filters.period === "custom" ? (
                  <>
                    <label className="space-y-2 text-xs font-medium text-muted-foreground">
                      De
                      <input
                        type="date"
                        aria-label="De"
                        className={inputClass}
                        value={filters.from}
                        onInput={(e) => onChange({ from: e.currentTarget.value })}
                        onChange={(e) => onChange({ from: e.target.value })}
                      />
                    </label>
                    <label className="space-y-2 text-xs font-medium text-muted-foreground">
                      Até
                      <input
                        type="date"
                        aria-label="Até"
                        className={inputClass}
                        value={filters.to}
                        onInput={(e) => onChange({ to: e.currentTarget.value })}
                        onChange={(e) => onChange({ to: e.target.value })}
                      />
                    </label>
                  </>
                ) : (
                  <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">
                    <span className="block font-medium text-foreground">{copy.date}</span>Horário de
                    Bruxelas · Os cartões e a lista seguem os mesmos filtros.
                  </p>
                )}
              </div>
              {filters.period === "custom" && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {copy.date} · Bruxelas · Datas inicial e final incluídas.
                </p>
              )}
              {model?.invalidPeriod && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  Escolha datas válidas, com o início anterior ou igual ao fim.
                </p>
              )}
            </section>
            <section aria-labelledby="finance-area-title" className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2
                    id="finance-area-title"
                    className="font-display text-xl font-semibold sm:text-2xl"
                  >
                    {copy.title}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {copy.description}
                  </p>
                </div>
                <span className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
                  EUR · Euro
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {model?.metrics.map((metric, index) => (
                  <Metric
                    key={metric.label}
                    metric={metric}
                    prominent={index === 0 && metric.value !== null}
                  />
                ))}
              </div>
              <SourceNote area={area} role={data.role} />
              {area === "payouts" ? (
                <PayoutRoadmap />
              ) : model && !model.invalidPeriod && !model.sourceAvailable ? (
                <div role="alert" className="rounded-2xl border border-border bg-card p-6">
                  <h3 className="font-semibold">Não foi possível conferir esta fonte</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Os totais ficam a apurar para evitar apresentar uma leitura incompleta como
                    fechamento.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={onRefresh}
                    disabled={fetching}
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : model && !model.invalidPeriod ? (
                <Records
                  key={`${area}-${filters.period}-${filters.from}-${filters.to}-${filters.artist}`}
                  data={data}
                  model={model}
                />
              ) : null}
            </section>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
              <span>Última leitura: {dateLabel(data.updatedAt)} · Bruxelas</span>
              {isAdmin && (
                <Link
                  to="/reconciliar"
                  className="inline-flex min-h-11 items-center gap-1 text-primary underline-offset-4 hover:underline"
                >
                  Conferir vínculos e divergências
                  <ChevronRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              )}
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
function Metric({ metric, prominent }: { metric: WorkspaceMetric; prominent: boolean }) {
  return (
    <div
      className={`flex min-h-36 min-w-0 flex-col rounded-2xl border p-4 sm:p-5 ${prominent ? "border-primary/25 bg-accent/50" : "border-border bg-card"}`}
    >
      <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
      <p
        className={`my-3 break-words font-display font-semibold tabular-nums ${metric.value === null ? "text-xl text-muted-foreground" : "text-2xl sm:text-3xl"}`}
      >
        {metric.value === null
          ? "A apurar"
          : metric.kind === "money"
            ? money(metric.value)
            : metric.value}
      </p>
      <p className="mt-auto text-xs leading-5 text-muted-foreground">{metric.note}</p>
    </div>
  );
}
function SourceNote({ area, role }: { area: FinanceArea; role: FinanceWorkspaceData["role"] }) {
  const note =
    area === "projects"
      ? "A carteira mostra orçamentos locais. A data de ganho no GHL ainda precisa ser conciliada para apurar vendas do período. Cadastro, atualização e sessão não comprovam a data da venda."
      : area === "receipts"
        ? "Recebimentos registrados não equivalem a confirmação bancária. Esta visão usa os lançamentos do app; sinais anotados nos projetos e pagamentos de outras fontes não são somados novamente."
        : area === "sessions"
          ? role === "seller"
            ? "Você vê somente sua estimativa de comissão como vendedor, calculada com o percentual atual do cadastro. Recebimento do cliente não comprova repasse ao vendedor."
            : role === "artist"
              ? "Você vê somente sua comissão estimada, com o percentual gravado no agendamento. A regra por data de realização ainda precisa ser conferida. Consultas Randevu, cancelamentos e faltas ficam fora dos totais; recebimento do cliente não comprova seu repasse."
              : "As estimativas do tatuador usam o percentual gravado no agendamento; as do vendedor usam seu percentual atual. A regra de André por realização (35% em novembro de 2026; 40% a partir de dezembro) ainda precisa ser conciliada com esses registros. Consultas Randevu, cancelamentos e faltas ficam fora dos totais."
          : "Ainda não há uma fonte validada de repasses nesta tela. Recebimentos dos clientes e estimativas de comissão não são apresentados como pagamentos à equipe.";
  return (
    <details className="rounded-xl border border-border bg-card px-4">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <CircleHelp className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        Como estes valores são apurados
      </summary>
      <p className="pb-4 text-sm leading-6 text-muted-foreground">{note}</p>
    </details>
  );
}
function PayoutRoadmap() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <Wallet className="mt-1 h-6 w-6 text-primary" aria-hidden="true" />
        <div>
          <h3 className="font-display text-lg font-semibold">Apuração de repasses pendente</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            O extrato ficará disponível quando cada repasse tiver beneficiário, valor, período e
            confirmação de pagamento registrados. Não há saldo de repasse confirmado nesta leitura.
          </p>
        </div>
      </div>
      <ol className="mt-6 grid gap-3 md:grid-cols-3">
        {[
          "Conferir sessões e percentuais",
          "Aprovar o valor a repassar",
          "Registrar o pagamento à equipe",
        ].map((label, i) => (
          <li key={label} className="rounded-xl bg-muted/40 p-4">
            <span className="mb-2 block text-xs font-medium text-primary">Etapa {i + 1}</span>
            <span className="text-sm">{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
function Records({
  data,
  model,
}: {
  data: FinanceWorkspaceData;
  model: ReturnType<typeof buildFinanceWorkspace>;
}) {
  const [limit, setLimit] = useState(30);
  const rows =
    model.area === "projects"
      ? model.projects
      : model.area === "receipts"
        ? model.receipts
        : model.sessions;
  const count = rows.length;
  const admin = data.role === "admin";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">
          {model.area === "projects"
            ? "Projetos cadastrados"
            : model.area === "receipts"
              ? "Lançamentos do período"
              : "Agendamentos do período"}
        </h3>
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {count} {count === 1 ? "registro" : "registros"}
        </p>
      </div>
      {count === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <h4 className="font-medium">Nenhum registro neste recorte</h4>
          <p className="mt-2 text-sm text-muted-foreground">
            Ajuste o período ou o tatuador para consultar outros registros.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {model.area === "projects" &&
            model.projects.slice(0, limit).map((p) => (
              <Record
                key={p.id}
                title={p.title}
                subtitle={[p.client, p.artist].filter(Boolean).join(" · ")}
                date={dateLabel(p.date)}
                dateCaption="Cadastro"
                amount={money(p.quotedCents)}
                amountCaption="Orçamento cadastrado"
                badge={statusNames[p.status] ?? p.status}
                details={
                  <>
                    <span>Oportunidade GHL: {p.opportunityId ?? "Vínculo a conferir"}</span>
                    <span>Data de venda: a apurar</span>
                  </>
                }
                action={
                  <Link
                    to="/projetos/$projectId"
                    params={{ projectId: p.id }}
                    className={actionClass}
                  >
                    Ver projeto
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                }
              />
            ))}
          {model.area === "receipts" &&
            model.receipts.slice(0, limit).map((r) => (
              <Record
                key={r.id}
                title={r.client}
                subtitle={r.artist ?? "Tatuador a conferir"}
                date={dateLabel(r.date)}
                dateCaption="Pagamento informado"
                amount={
                  r.amountCents === null
                    ? "A apurar"
                    : money(r.kind === "estorno" ? -r.amountCents : r.amountCents)
                }
                amountCaption={r.kind === "estorno" ? "Saída registrada" : "Entrada registrada"}
                badge={statusNames[r.kind] ?? r.kind}
                details={
                  <>
                    <span>
                      {r.methods.join(" + ") || "Forma a conferir"} · Conciliação bancária pendente
                    </span>
                    <span>
                      {r.projectId ? "Projeto vinculado" : "Projeto a vincular"} · GHL:{" "}
                      {r.sync === "synced"
                        ? "sincronizado"
                        : r.sync === "failed"
                          ? "falha na sincronização"
                          : "sincronização pendente"}
                    </span>
                    <span className="break-all text-xs">Lançamento: {r.id}</span>
                  </>
                }
                action={
                  r.projectId ? (
                    <Link
                      to="/projetos/$projectId"
                      params={{ projectId: r.projectId }}
                      className={actionClass}
                    >
                      Ver projeto
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : undefined
                }
              />
            ))}
          {model.area === "sessions" &&
            model.sessions.slice(0, limit).map((s) => (
              <Record
                key={s.id}
                title={s.client ?? "Cliente a conferir"}
                subtitle={admin ? (s.artist ?? "Tatuador a conferir") : "Seu agendamento"}
                date={dateLabel(s.date)}
                dateCaption="Agenda"
                amount={s.excluded ? "Fora dos totais" : money(s.commissionCents)}
                amountCaption="Comissão estimada"
                badge={statusNames[s.status] ?? s.status}
                details={
                  <>
                    <span>
                      {s.excluded
                        ? "Consulta, cancelamento ou falta: sem comissão nesta estimativa."
                        : `Percentual ${data.role === "seller" ? "atual" : "cadastrado"}: ${s.commissionPct === null ? "a conferir" : `${s.commissionPct}%`}`}
                    </span>
                    {admin && (
                      <span>
                        Base cadastrada: {money(s.amountCents)} · não representa venda ou
                        recebimento
                      </span>
                    )}
                    {admin && !s.excluded && s.sellerId && (
                      <span>
                        Vendedor: {s.seller ?? "Cadastro a conferir"} · comissão estimada{" "}
                        {money(s.sellerCommissionCents)} pelo percentual atual
                      </span>
                    )}
                    <span>Repasse: a apurar</span>
                  </>
                }
                action={
                  s.projectId && data.role !== "seller" ? (
                    <Link
                      to="/projetos/$projectId"
                      params={{ projectId: s.projectId }}
                      className={actionClass}
                    >
                      Ver projeto
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : undefined
                }
              />
            ))}
        </div>
      )}
      {count > limit && (
        <Button
          variant="outline"
          className="min-h-11 w-full rounded-xl"
          onClick={() => setLimit((v) => v + 30)}
        >
          Mostrar mais · {count - limit} restantes
        </Button>
      )}
    </div>
  );
}
function Record({
  title,
  subtitle,
  date,
  dateCaption,
  amount,
  amountCaption,
  badge,
  details,
  action,
}: {
  title: string;
  subtitle: string;
  date: string;
  dateCaption: string;
  amount: string;
  amountCaption: string;
  badge: string;
  details: ReactNode;
  action?: ReactNode;
}) {
  return (
    <article className="border-b border-border p-4 last:border-b-0 sm:p-5">
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_180px_200px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="break-words text-sm font-semibold sm:text-base">{title}</h4>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
              {badge}
            </span>
          </div>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{dateCaption}</p>
          <p className="mt-1 text-sm">{date}</p>
        </div>
        <div className="lg:text-right">
          <p className="text-xs text-muted-foreground">{amountCaption}</p>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums">{amount}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="grid min-w-0 gap-1 text-xs leading-5 text-muted-foreground">{details}</div>
        {action}
      </div>
    </article>
  );
}
