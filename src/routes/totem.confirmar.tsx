import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { TotemConfirmView } from "@/components/checkin/totem-views";
import { confirmarChegada } from "@/lib/checkin.functions";
import { checkinRequestError } from "@/components/checkin/checkin-presentation";
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
  const { modo, session, setSession, novoNome, novoTelefone, consentimento, setConsentimento } =
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
    if ((session?.agendamentosHoje?.length ?? 0) > 1 && !agendamento) {
      setErro("Selecione o agendamento que será vinculado à sua chegada.");
      return;
    }
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
      setErro(checkinRequestError(e, "Não foi possível registrar agora. Chame a equipe."));
    } finally {
      setEnviando(false);
    }
  }

  if (!nome) return null;

  return (
    <TotemConfirmView
      mode={modo}
      name={nome}
      appointment={agendamento}
      appointments={session?.agendamentosHoje}
      onAppointmentChange={(appointmentId) => {
        if (!session) return;
        const selected =
          session.agendamentosHoje.find((item) => item.appointmentId === appointmentId) ?? null;
        setSession({ ...session, agendamentoHoje: selected });
        setErro(null);
      }}
      consent={consentimento}
      onConsentChange={setConsentimento}
      sending={enviando}
      error={erro}
      onConfirm={() => void handleConfirmar()}
      onBack={() => navigate({ to: "/totem/buscar" })}
    />
  );
}
