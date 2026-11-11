import type { ReactNode } from "react";
import type { ProjectDetail, ProjectOpportunitiesResult } from "@/lib/projects.functions";
import { formatEurCents } from "@/lib/project-progress-core";
import { formatProjectDate, PROJECT_APPOINTMENT_STATUS } from "@/lib/project-journey-core";
import { OPP_STATUS_LABEL } from "@/lib/ghl-opportunities-core";
import { DistributionEditor } from "./distribution-editor";
import { opportunityContractDivergence } from "@/lib/project-distribution-core";

type OppState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; data: ProjectOpportunitiesResult };

/**
 * Ficha de projeto "papel de orçamento": cliente e próxima sessão dominam;
 * trilha cronológica Randevu → sessões; financeiro admin separado.
 */
export function ProjectFicha({
  p,
  opps,
  selectedOpp,
  onSelectOpp,
  actions,
}: {
  p: ProjectDetail;
  opps?: OppState;
  selectedOpp?: string | null;
  onSelectOpp?: (id: string | null) => void;
  actions?: ReactNode;
}) {
  const admin = p.role === "admin";
  const next = p.progress.nextStartAt;
  const active = p.sessions.filter((s) => s.status !== "cancelled");
  // Consultas Randevu do mesmo contato são candidatas: ficam fora da trilha até vínculo explícito.
  const trail = [
    ...([] as { kind: "rdv"; id: string; startAt: string; status: string }[]),
    ...p.sessions.map((s) => ({ kind: "session" as const, ...s })),
  ].sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <article className="ficha space-y-6">
      <header className="space-y-3 border-b border-border pb-5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground">Ficha de projeto</p>
        <h1 className="font-editorial text-3xl leading-tight">
          {p.client.name ?? "Cliente sem nome"}
        </h1>
        <p className="text-base">
          {p.title}
          {p.bodyPart ? <span className="text-muted-foreground"> · {p.bodyPart}</span> : null}
        </p>
        <div className="ficha-next">
          <p className="text-xs text-muted-foreground">Próxima sessão</p>
          <p className="text-lg font-semibold tabular-nums">
            {next ? formatProjectDate(next) : "Sem próxima sessão marcada"}
          </p>
          <p className="text-xs text-muted-foreground">
            {p.progress.done} de {p.progress.total} sessões com conclusão registrada · horário de
            Bruxelas
          </p>
        </div>
        {actions}
      </header>

      {admin ? (
        <section aria-labelledby="opp-title" className="ficha-panel space-y-3">
          <h2 id="opp-title" className="font-editorial text-lg">
            Oportunidade no GHL
          </h2>
          <p className="text-sm">
            Vinculada:{" "}
            <span className="font-medium">
              {p.opportunityId ? "sim" : "nenhuma oportunidade vinculada"}
            </span>
          </p>
          <OpportunityList
            opps={opps}
            selected={selectedOpp ?? null}
            onSelect={onSelectOpp}
            contractCents={p.finance.quotedCents}
          />
        </section>
      ) : null}

      {admin && p.consultations.length > 0 ? (
        <section aria-labelledby="cand-title" className="ficha-panel space-y-2">
          <h2 id="cand-title" className="font-editorial text-lg">
            Consultas Randevu do mesmo contato
          </h2>
          <p className="text-xs text-muted-foreground">
            Candidatas, não vinculadas a este projeto. Consulta não é sessão e não gera comissão.
          </p>
          <ul className="space-y-1">
            {p.consultations.map((c) => (
              <li key={c.id} className="text-sm tabular-nums">
                {formatProjectDate(c.startAt)} ·{" "}
                <span className="text-muted-foreground">
                  {PROJECT_APPOINTMENT_STATUS[c.status] ?? "Status não verificado"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="trail-title" className="space-y-3">
        <h2 id="trail-title" className="font-editorial text-lg">
          Trilha do projeto
        </h2>
        {trail.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum agendamento vinculado. Continuidade a verificar.
          </p>
        ) : (
          <ol className="ficha-trail">
            {trail.map((t) =>
              t.kind === "rdv" ? (
                <li key={t.id} className="ficha-step ficha-step--rdv">
                  <p className="text-sm font-medium">Randevu · consulta</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {formatProjectDate(t.startAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">Não é sessão e não gera comissão.</p>
                </li>
              ) : (
                <li
                  key={t.id}
                  className={`ficha-step ${t.status === "cancelled" ? "ficha-step--off" : ""} ${t.status === "completed" ? "ficha-step--done" : ""}`}
                >
                  <p className="text-sm font-medium">
                    {t.status === "cancelled"
                      ? "Sessão cancelada"
                      : `Sessão ${t.index} de ${t.total}`}
                    <span className="text-muted-foreground">
                      {" "}
                      · {t.artistName ?? "Tatuador a definir"}
                    </span>
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {formatProjectDate(t.startAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {PROJECT_APPOINTMENT_STATUS[t.status] ?? "Status não verificado"}
                  </p>
                </li>
              ),
            )}
          </ol>
        )}
      </section>

      {admin ? (
        <section aria-labelledby="fin-title" className="space-y-4">
          <h2 id="fin-title" className="font-editorial text-lg">
            Valores do projeto
          </h2>
          <dl className="ficha-panel grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Money label="Contratado (uma vez)" v={p.finance.quotedCents} />
            <Money label="Recebimentos registrados" v={p.finance.receivedCents} />
            <Money label="Sinal anotado (não somado)" v={p.finance.depositCents} />
            <Money label="Saldo pelos registros" v={p.finance.balanceCents} />
          </dl>
          <p className="text-xs text-muted-foreground">
            Recebido vem apenas das movimentações registradas; o sinal anotado não é somado de novo.
            "A apurar" não é zero.
          </p>
          <DistributionEditor
            key={p.id}
            projectId={p.id}
            contractCents={p.finance.quotedCents}
            sessions={active.map((s) => ({
              id: s.id,
              index: s.index,
              artistId: s.artistId,
              artistName: s.artistName,
              startAt: s.startAt,
              status: s.status,
              snapshotPct: s.snapshotPct,
              realizedAt: s.realizedAt,
            }))}
          />
        </section>
      ) : (
        <section aria-labelledby="fin-title" className="ficha-panel">
          <h2 id="fin-title" className="font-editorial text-lg">
            Sua parte
          </h2>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">
            {formatEurCents(p.finance.artistShareCents)}
          </p>
          <p className="text-xs text-muted-foreground">
            Sobre o recebido registrado. "A apurar" não é zero.
          </p>
        </section>
      )}
    </article>
  );
}

function OpportunityList({
  opps,
  selected,
  onSelect,
  contractCents,
}: {
  opps?: OppState;
  contractCents: number | null;
  selected: string | null;
  onSelect?: (id: string | null) => void;
}) {
  if (!opps || opps.kind === "loading")
    return <p className="text-sm text-muted-foreground">Lendo oportunidades do contato…</p>;
  if (opps.kind === "error")
    return (
      <p role="alert" className="text-sm text-destructive">
        Não foi possível ler o GHL. Nenhuma ação disponível.
      </p>
    );
  const d = opps.data;
  return (
    <div className="space-y-2">
      {!d.pipelineConfigured ? (
        <p className="text-sm text-warning">
          Funil deste tatuador: configuração pendente. Nenhuma oportunidade liberada para seleção.
        </p>
      ) : null}
      {!d.complete ? (
        <p role="alert" className="text-sm text-destructive">
          Leitura incompleta (
          {d.reason === "no_contact" ? "projeto sem contato GHL" : "paginação não confirmada"}).
          Seleção bloqueada.
        </p>
      ) : null}
      {d.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma oportunidade encontrada para o contato.
        </p>
      ) : (
        <fieldset disabled={!d.complete || !d.pipelineConfigured} className="space-y-1">
          <legend className="sr-only">Selecionar oportunidade (rascunho)</legend>
          {d.items.map((o) => {
            const usable = o.inArtistPipeline && !o.linkedElsewhereProjectId;
            return (
              <label
                key={o.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-card px-3 py-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:checked]:border-primary has-[:checked]:bg-accent"
              >
                <input
                  type="radio"
                  name="opp"
                  className="h-4 w-4 accent-[var(--primary)]"
                  checked={selected === o.id}
                  disabled={!usable}
                  onChange={() => onSelect?.(o.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{o.name ?? "Sem nome"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {OPP_STATUS_LABEL[o.status ?? ""] ?? "Status não verificado"} ·{" "}
                    {formatEurCents(o.monetaryValueCents)}
                    {o.linkedHere ? " · vinculada a este projeto" : ""}
                    {o.linkedElsewhereProjectId ? " · já vinculada a outro projeto" : ""}
                    {!o.inArtistPipeline ? " · fora do funil do tatuador" : ""}
                  </span>
                  {opportunityContractDivergence(o.monetaryValueCents, contractCents) ===
                  "different" ? (
                    <span className="block text-xs font-medium text-warning">
                      Valor difere do contrato ({formatEurCents(contractCents)}) — divergência, nada
                      sobrescrito
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
      {selected ? (
        <p className="text-xs text-warning">
          Seleção em rascunho — não vinculada nem enviada ao GHL.
        </p>
      ) : null}
    </div>
  );
}

function Money({ label, v }: { label: string; v: number | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-base font-medium">{formatEurCents(v)}</dd>
    </div>
  );
}
