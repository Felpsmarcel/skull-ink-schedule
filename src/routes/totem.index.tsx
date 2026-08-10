import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarCheck, UserPlus } from "lucide-react";
import { useTotemDraft } from "@/stores/totem-checkin";
import gfMark from "@/assets/gf-mark.png";

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

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-10 bg-background px-6 py-12 text-foreground">
      <div className="flex flex-col items-center gap-4 text-center">
        <img src={gfMark} alt="" className="h-20 w-20 object-contain" />
        <h1 className="font-display text-3xl uppercase tracking-[0.2em]">Bem-vindo</h1>
        <p className="max-w-sm text-base text-muted-foreground">
          Confirme a sua chegada para avisarmos a equipa.
        </p>
      </div>

      <div className="flex w-full max-w-md flex-col gap-4">
        <button
          type="button"
          onClick={() => escolher("agendado")}
          className="flex min-h-24 items-center gap-4 rounded-xl bg-primary px-6 text-left text-primary-foreground shadow-lg transition-transform active:scale-[0.98]"
        >
          <CalendarCheck className="h-8 w-8 shrink-0" />
          <span className="text-lg font-bold uppercase tracking-wider">Tenho agendamento</span>
        </button>
        <button
          type="button"
          onClick={() => escolher("novo")}
          className="flex min-h-24 items-center gap-4 rounded-xl border border-border bg-card px-6 text-left transition-transform active:scale-[0.98]"
        >
          <UserPlus className="h-8 w-8 shrink-0 text-muted-foreground" />
          <span className="text-lg font-bold uppercase tracking-wider">Sou um novo cliente</span>
        </button>
      </div>
    </div>
  );
}
