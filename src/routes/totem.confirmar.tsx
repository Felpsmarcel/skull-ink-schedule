import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Clock, Loader2, User } from "lucide-react";
import { confirmarChegada } from "@/lib/checkin.functions";
import { useTotemDraft } from "@/stores/totem-checkin";

export const Route = createFileRoute("/totem/confirmar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Confirmar chegada — GF Tattoo" },
      { name: "description", content: "Confira os dados e confirme a sua chegada." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: TotemConfirmar,
});

function TotemConfirmar() {
  const navigate = useNavigate();
  const { modo, session, novoNome, novoTelefone, consentimento, setConsentimento } =
    useTotemDraft();
  const confirmar = useServerFn(confirmarChegada);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nome = session?.nome ?? novoNome;
  const telefone = session?.telefone ?? novoTelefone;
  const agendamento = session?.agendamentoHoje ?? null;

  useEffect(() => {
    if (!nome) navigate({ to: "/totem", replace: true });
  }, [nome, navigate]);

  async function handleConfirmar() {
    setErro(null);
    setEnviando(true);
    try {
      const res = await confirmar({
        data: {
          nome,
          telefone: telefone || null,
          contactId: session?.contactId ?? null,
          ghlContactId: session?.ghlContactId ?? null,
          appointmentId: agendamento?.appointmentId ?? null,
          artistId: agendamento?.artistId ?? null,
          scheduledAtISO: agendamento?.scheduledAtISO ?? null,
          consentimento,
        },
      });
      navigate({ to: "/totem/pronto", search: { token: res.token } });
    } catch (e) {
      setErro(
        e instanceof Error
          ? "Não foi possível registar agora. Chame a equipa."
          : "Não foi possível registar agora.",
      );
    } finally {
      setEnviando(false);
    }
  }

  if (!nome) return null;

  return (
    <div className="min-h-svh bg-background px-6 py-10 text-foreground">
      <header className="mx-auto mb-8 flex w-full max-w-md items-center gap-3">
        <Link to="/totem/buscar" className="rounded-md p-3 hover:bg-muted" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold uppercase tracking-wider">Confirmar chegada</h1>
      </header>

      <div className="mx-auto w-full max-w-md space-y-5">
        <div className="space-y-3 rounded-xl border border-border bg-card p-5">
          <Linha icon={<User className="h-4 w-4" />} label="Cliente" value={nome} />
          {agendamento ? (
            <>
              <Linha
                icon={<Clock className="h-4 w-4" />}
                label="Horário agendado"
                value={new Date(agendamento.scheduledAtISO).toLocaleTimeString("pt-PT", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Brussels",
                })}
              />
              <Linha
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Tatuador"
                value={agendamento.artistNome ?? "A confirmar"}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {modo === "novo"
                ? "Primeira visita — a equipa vai atendê-lo em seguida."
                : "Não encontrámos agendamento para hoje. A equipa será avisada da sua chegada."}
            </p>
          )}
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm">
          <input
            type="checkbox"
            checked={consentimento}
            onChange={(e) => setConsentimento(e.target.checked)}
            className="mt-0.5 h-5 w-5"
          />
          <span className="text-muted-foreground">
            Aceito receber a confirmação do atendimento por WhatsApp ou SMS.
          </span>
        </label>

        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

        <button
          type="button"
          onClick={handleConfirmar}
          disabled={enviando}
          className="flex h-20 w-full items-center justify-center gap-3 rounded-xl bg-primary text-lg font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-60 active:scale-[0.98]"
        >
          {enviando ? <Loader2 className="h-6 w-6 animate-spin" /> : null}
          Confirmar minha chegada
        </button>
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
      <span className="text-base font-semibold">{value}</span>
    </div>
  );
}
