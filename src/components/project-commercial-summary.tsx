import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProjectCommercialPresentation } from "@/lib/artist-panel.functions";
import { formatEurCents } from "@/lib/project-progress-core";

/** Mount only in the existing admin detail; endpoint independently verifies admin. */
export function ProjectCommercialSummary({ projectId }: { projectId: string }) {
  const read = useServerFn(getProjectCommercialPresentation);
  const { data, isPending, error } = useQuery({ queryKey: ["project-commercial-presentation", projectId], queryFn: () => read({ data: { projectId } }), retry: false });
  if (isPending) return <p role="status" className="text-sm text-muted-foreground">Conferindo as fontes comerciais e de caixa…</p>;
  if (error || !data) return <p role="alert" className="text-sm text-muted-foreground">Fontes financeiras indisponíveis. Valores a conciliar.</p>;
  return <div className="space-y-5">
    <section aria-label="Referência comercial" className="space-y-3 border-b border-border pb-4">
      <h3 className="text-base font-semibold">Referência comercial</h3>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Value label="Valor do projeto" value={data.quotedCents} />
        <Value label="Sinal informado" value={data.depositCents} />
        <Value label="Saldo comercial indicativo" value={data.indicativeBalance} unresolved="A conciliar" />
      </dl>
      <p className="text-xs leading-5 text-muted-foreground">Fonte: valor e sinal anotados no projeto. O sinal não comprova entrada no caixa; pagamento anterior sem vínculo financeiro auditável ao projeto. Conciliação pendente.</p>
      {data.needsReconciliation ? <p className="text-xs text-muted-foreground">A conciliar: não deduzimos sinal e caixa juntos, pois podem representar o mesmo recebimento.</p> : null}
    </section>
    <section aria-label="Caixa do projeto" className="space-y-3">
      <h3 className="text-base font-semibold">Caixa do projeto</h3>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Value label="Recebido no caixa" value={data.cash} />
        <Value label="Saldo apurado por movimentações" value={data.cashBalance} />
      </dl>
      <p className="text-xs leading-5 text-muted-foreground">Fonte: movimentações locais não excluídas vinculadas ao projeto. {data.movementsCount === null ? "Fonte indisponível." : `${data.movementsCount} lançamento(s).`} Não representa repasse realizado nem confirma status comercial no GHL.</p>
    </section>
  </div>;
}

function Value({ label, value, unresolved = "A apurar" }: { label: string; value: number | null; unresolved?: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-base font-semibold tabular-nums">{value === null ? unresolved : formatEurCents(value)}</dd></div>;
}