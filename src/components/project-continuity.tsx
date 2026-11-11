import { formatProjectDate, projectContinuity } from "@/lib/project-journey-core";

export function ProjectContinuity({ nextStartAt }: { nextStartAt: string | null }) {
  const next = projectContinuity(nextStartAt);
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium text-foreground">
        {next.startAt ? `Próximo agendamento: ${formatProjectDate(next.startAt)}` : "Sem próxima sessão marcada"}
      </p>
      {!next.startAt ? <p className="text-xs text-muted-foreground">Continuidade a verificar; não indica conclusão ou abandono.</p> : null}
    </div>
  );
}