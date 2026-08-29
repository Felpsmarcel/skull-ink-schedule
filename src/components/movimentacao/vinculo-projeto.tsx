import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Link2, Link2Off, Loader2 } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getProjectFinance, listPaymentTargets } from "@/lib/projects.functions";
import { TIPOS_QUE_EXIGEM_VINCULO } from "@/lib/linking";

export interface VinculoValue {
  projectId: string | null;
  appointmentId: string | null;
  justificativa: string;
}

interface Props {
  /** Só o modo autenticado (manual/admin) consegue listar agendamentos. */
  canPickAppointment: boolean;
  tipo: string;
  clientName: string;
  value: VinculoValue;
  onChange: (patch: Partial<VinculoValue>) => void;
  /** Preenche automaticamente cliente/tatuador/data ao escolher agendamento. */
  onPick?: (target: {
    contactName: string | null;
    artistId: string;
    startAt: string;
  }) => void;
}

function fmtEur(v: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v);
}

export function VinculoProjeto({
  canPickAppointment,
  tipo,
  clientName,
  value,
  onChange,
  onPick,
}: Props) {
  const exige = TIPOS_QUE_EXIGEM_VINCULO.includes(tipo);
  const fetchTargets = useServerFn(listPaymentTargets);
  const fetchFinance = useServerFn(getProjectFinance);

  const term = clientName.trim();
  const targetsQ = useQuery({
    queryKey: ["payment-targets", term],
    enabled: canPickAppointment,
    staleTime: 30_000,
    queryFn: () => fetchTargets({ data: { search: term.length >= 2 ? term : null } }),
  });

  const financeQ = useQuery({
    queryKey: ["project-finance", value.projectId ?? "none"],
    enabled: Boolean(value.projectId),
    staleTime: 15_000,
    queryFn: () => fetchFinance({ data: { projectId: value.projectId! } }),
  });

  const targets = targetsQ.data ?? [];
  const linked = Boolean(value.appointmentId || value.projectId);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        {linked ? (
          <Link2 className="h-4 w-4 text-primary" />
        ) : (
          <Link2Off className="h-4 w-4 text-muted-foreground" />
        )}
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Projeto / agendamento
        </h3>
      </div>

      {canPickAppointment ? (
        targetsQ.isLoading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> A carregar agendamentos…
          </p>
        ) : targets.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum agendamento recente encontrado para este nome.
          </p>
        ) : (
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {targets.map((t) => {
              const active = value.appointmentId === t.appointmentId;
              return (
                <li key={t.appointmentId}>
                  <button
                    type="button"
                    onClick={() => {
                      if (active) {
                        onChange({ appointmentId: null, projectId: null });
                        return;
                      }
                      onChange({
                        appointmentId: t.appointmentId,
                        projectId: t.projectId,
                        justificativa: "",
                      });
                      onPick?.({
                        contactName: t.contactName,
                        artistId: t.artistId,
                        startAt: t.startAt,
                      });
                    }}
                    className={cn(
                      "w-full rounded-md border p-2 text-left",
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:bg-muted",
                    )}
                  >
                    <span className="block truncate text-sm font-medium">
                      {t.contactName ?? "Sem nome"}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {new Intl.DateTimeFormat("pt-PT", {
                        timeZone: "Europe/Brussels",
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(t.startAt))}
                      {" · "}
                      {fmtEur(t.totalEur)}
                      {t.projectId ? "" : " · sem projeto"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <p className="text-xs text-muted-foreground">
          Este link público não lista agendamentos. Para sinal e sessão sem agendamento,
          escreva a justificativa abaixo.
        </p>
      )}

      {value.projectId && financeQ.data ? (
        <dl className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background p-2 text-xs">
          <Cell label="Valor contratado" value={fmtEur(financeQ.data.quotedTotalEur)} />
          <Cell label="Sinal acumulado" value={fmtEur(financeQ.data.sinalEur)} />
          <Cell label="Recebido" value={fmtEur(financeQ.data.recebidoEur)} />
          <Cell label="Saldo" value={fmtEur(financeQ.data.saldoEur)} />
        </dl>
      ) : null}

      {exige && !linked ? (
        <div>
          <Label htmlFor="justificativa" className="flex items-center gap-1.5 text-[11px]">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Justificativa para lançar sem agendamento (obrigatória)
          </Label>
          <Textarea
            id="justificativa"
            rows={2}
            value={value.justificativa}
            onChange={(e) => onChange({ justificativa: e.target.value.slice(0, 500) })}
            placeholder="Ex.: cliente pagou sinal ao telefone, agendamento será criado depois."
            className="mt-1"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">Mínimo 10 caracteres.</p>
        </div>
      ) : null}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
