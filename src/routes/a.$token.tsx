import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Clock, Loader2, User } from "lucide-react";
import { getCheckinByToken, type CheckinStatus } from "@/lib/checkin.functions";
import gfMark from "@/assets/gf-mark.png";

export const Route = createFileRoute("/a/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "O seu atendimento — GF Tattoo Studio" },
      { name: "description", content: "Acompanhe o estado do seu atendimento no GF Tattoo." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AtendimentoPublico,
});

const STATUS_LABEL: Record<CheckinStatus, string> = {
  aguardando: "Aguardando atendimento",
  em_atendimento: "Em atendimento",
  concluido: "Atendimento concluído",
  nao_compareceu: "Não compareceu",
  cancelado: "Cancelado",
};

function AtendimentoPublico() {
  const { token } = Route.useParams();
  const fetchCheckin = useServerFn(getCheckinByToken);

  const { data, isLoading } = useQuery({
    queryKey: ["checkin-publico", token],
    queryFn: () => fetchCheckin({ data: { token } }),
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-svh bg-background px-5 py-10 text-foreground">
      <div className="mx-auto w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src={gfMark} alt="" className="h-12 w-12 object-contain" />
          <h1 className="font-display text-lg uppercase tracking-[0.2em]">GF Tattoo</h1>
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Este link não é válido. Fale com a equipa do estúdio.
          </div>
        ) : data.expirado ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Este link expirou. Ele é válido apenas no dia do atendimento.
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Código do atendimento
              </p>
              <p className="mt-1 text-4xl font-bold tracking-widest">{data.codigo}</p>
              <span className="mt-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                {STATUS_LABEL[data.status]}
              </span>
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-card p-5 text-sm">
              <Linha
                icon={<Clock className="h-4 w-4" />}
                label="Horário agendado"
                value={
                  data.scheduledAtISO
                    ? new Date(data.scheduledAtISO).toLocaleTimeString("pt-PT", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Europe/Brussels",
                      })
                    : "Sem horário marcado"
                }
              />
              <Linha
                icon={<User className="h-4 w-4" />}
                label="Tatuador"
                value={data.tatuadorPrimeiroNome ?? "A confirmar"}
              />
              <Linha
                icon={<Clock className="h-4 w-4" />}
                label="Chegada registada"
                value={new Date(data.arrivedAtISO).toLocaleTimeString("pt-PT", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Brussels",
                })}
              />
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <BellRing className="mt-0.5 h-4 w-4 shrink-0" />
              <span>A equipa foi notificada da sua chegada. Aguarde no espaço de espera.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Linha({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
