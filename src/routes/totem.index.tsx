import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTotemDraft } from "@/stores/totem-checkin";
import { TotemWelcomeView } from "@/components/checkin/totem-views";

export const Route = createFileRoute("/totem/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Check-in — GF Tattoo Studio" },
      { name: "description", content: "Confirme a sua chegada no estúdio GF Tattoo." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: TotemWelcome,
});

function TotemWelcome() {
  const navigate = useNavigate();
  const { setModo, reset } = useTotemDraft();

  function escolher(modo: "agendado" | "novo") {
    reset();
    setModo(modo);
    navigate({ to: "/totem/buscar" });
  }

  return <TotemWelcomeView onChoose={escolher} />;
}
