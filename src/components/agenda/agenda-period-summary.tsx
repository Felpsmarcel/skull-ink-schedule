import {
  agendaOperationSummary,
  agendaMoney,
  valueEvent,
  type AgendaEntry,
  type AgendaReadState,
} from "@/lib/agenda-presentation";
import { summarizeAgendaValues, type AgendaValuesSource } from "@/lib/agenda-values-core";

export function AgendaPeriodSummary({
  entries,
  state,
  source,
  showValues,
}: {
  entries: AgendaEntry[];
  state: AgendaReadState;
  source: AgendaValuesSource;
  showValues: boolean;
}) {
  const operations = agendaOperationSummary(entries);
  const values = summarizeAgendaValues(
    entries.map(valueEvent),
    source,
    state === "ready" && !entries.some((entry) => entry.issue),
  );
  const metrics = [
    {
      label: "Atendimentos exibidos",
      value: state === "loading" ? "…" : String(operations.count),
      detail:
        state === "partial"
          ? "Leitura parcial dos calendários"
          : "Cada compromisso contado uma vez",
    },
    {
      label: "Confirmados na agenda",
      value:
        state === "ready" ? (operations.rate == null ? "—" : `${operations.rate}%`) : "A conferir",
      detail:
        state === "ready"
          ? `${operations.confirmed} de ${operations.active} ativos · status do GHL`
          : "Aguardando leitura dos calendários",
    },
    ...(showValues
      ? [
          {
            label: "Valores cadastrados",
            value: agendaMoney(values.totalCents),
            detail: "Anotações das sessões exibidas",
          },
          {
            label: "Sinais informados",
            value: agendaMoney(values.depositCents),
            detail: "Recebimento ainda não comprovado",
          },
          {
            label: "Diferença a conferir",
            value: agendaMoney(values.differenceCents),
            detail: "Valor menos sinal, por sessão",
          },
        ]
      : []),
  ];
  return (
    <section
      aria-label="Resumo dos compromissos exibidos"
      className="mx-auto w-full max-w-[1600px] px-3 pt-4 sm:px-6"
    >
      <dl
        className={`grid grid-cols-2 divide-x-0 gap-x-5 gap-y-4 border-y border-border py-4 ${showValues ? "lg:grid-cols-5" : "sm:grid-cols-2 sm:max-w-xl"}`}
      >
        {metrics.map((metric, index) => (
          <div key={metric.label} className={index > 1 ? "hidden min-w-0 lg:block" : "min-w-0"}>
            <dt className="text-xs font-medium text-muted-foreground">{metric.label}</dt>
            <dd className="mt-1 break-words text-xl font-semibold tabular-nums text-foreground sm:text-2xl">
              {metric.value}
            </dd>
            <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">{metric.detail}</dd>
          </div>
        ))}
      </dl>
      {showValues && (
        <>
          <details className="py-2 text-sm text-muted-foreground lg:hidden">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Valores das sessões · expandir
            </summary>
            <dl className="space-y-3 border-b border-border pb-4">
              {metrics.slice(2).map((metric) => (
                <div key={metric.label}>
                  <dt className="text-xs">{metric.label}</dt>
                  <dd className="text-xl font-semibold tabular-nums text-foreground">
                    {metric.value}
                  </dd>
                  <dd className="text-xs">{metric.detail}</dd>
                </div>
              ))}
            </dl>
            <ValueExplanation />
          </details>
          <details className="hidden py-1 text-xs leading-relaxed text-muted-foreground lg:block">
            <summary className="w-fit min-h-11 cursor-pointer py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Como ler os valores
              {values.unknownCount > 0 ? ` · ${values.unknownCount} sessão(ões) a conferir` : ""}
            </summary>
            <ValueExplanation />
          </details>
        </>
      )}
    </section>
  );
}

function ValueExplanation() {
  return (
    <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
      Os valores vêm do cadastro de cada sessão no app. Não representam venda Won, recebimento
      comprovado ou o valor total do projeto. Orçamentos Randevu, cancelamentos e faltas ficam fora
      dos totais. Se faltar vínculo ou valor, o total fica a conferir.
    </p>
  );
}
