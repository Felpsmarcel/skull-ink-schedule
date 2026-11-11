import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getAppointmentLinkInfo, getProjectDetail } from "@/lib/projects.functions";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  projectJourney,
  formatProjectDate,
  PROJECT_APPOINTMENT_STATUS,
} from "@/lib/project-journey-core";
import { ProjectContinuity } from "@/components/project-continuity";
import { Button } from "@/components/ui/button";

export function AppointmentProjectJourney({ ghlEventId }: { ghlEventId: string | null }) {
  const { data: me } = useCurrentUser();
  // Link discovery was already admin-only in this sheet. Do not broaden it to staff.
  if (me?.role !== "admin")
    return me?.role === "artist" ? (
      <section aria-label="Jornada do projeto" className="space-y-2 border-y border-border py-4">
        <h2 className="text-base font-semibold">Jornada do projeto</h2>
        <p className="text-xs text-muted-foreground">
          Vínculo não verificado nesta ficha. Consulte seus projetos autorizados.
        </p>
        <Button asChild variant="outline" className="min-h-11 w-full">
          <Link to="/projetos" search={{ status: "active" }}>
            Meus projetos
          </Link>
        </Button>
      </section>
    ) : null;
  return <AdminJourney key={ghlEventId} ghlEventId={ghlEventId} userId={me.userId} />;
}

function AdminJourney({ ghlEventId, userId }: { ghlEventId: string | null; userId: string }) {
  const fetchLink = useServerFn(getAppointmentLinkInfo);
  const fetchDetail = useServerFn(getProjectDetail);
  const q = useQuery({
    queryKey: ["appointment-project-journey", userId, ghlEventId],
    enabled: Boolean(ghlEventId),
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      if (!ghlEventId) return null;
      const link = await fetchLink({ data: { ghlEventId } });
      const detail = link.projectId
        ? await fetchDetail({ data: { projectId: link.projectId } })
        : null;
      return projectJourney(link, detail);
    },
  });
  const journey = q.error ? null : q.data;
  const p = journey?.project;
  return (
    <section
      aria-labelledby="project-journey-title"
      className="space-y-3 border-y border-border py-4"
    >
      <h2 id="project-journey-title" className="text-base font-semibold">
        Jornada do projeto
      </h2>
      <p className="text-xs text-muted-foreground">
        Tipo de atendimento não verificado. Consulta de orçamento não é automaticamente sessão de
        tatuagem.
      </p>
      {q.isFetching ? (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando jornada…
        </p>
      ) : q.error ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm">
            Jornada indisponível ou sem acesso. Nenhum vínculo foi presumido.
          </p>
          <Button variant="outline" className="min-h-11" onClick={() => q.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : !p ? (
        <p className="text-sm text-muted-foreground">
          {journey?.state === "unverified"
            ? "Vínculo a conferir; projeto indisponível ou correlação incompleta."
            : "Sem vínculo de projeto confirmado nesta ficha."}
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <p className="break-words font-semibold">{p.title}</p>
            <p className="text-xs text-muted-foreground">
              {journey?.state === "confirmed"
                ? "Vínculo local com projeto e oportunidade GHL confirmado"
                : "Projeto vinculado; vínculo com oportunidade GHL incompleto"}
            </p>
            <p className="text-xs text-muted-foreground">
              {p.progress.total} agendamentos vinculados não cancelados · {p.progress.done}{" "}
              conclusões registradas
            </p>
          </div>
          <ProjectContinuity nextStartAt={p.progress.nextStartAt} />
          <details className="border-t border-border pt-1">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
              Histórico de agendamentos ({p.sessions.length})
            </summary>
            {p.sessions.length ? (
              <ol className="space-y-3 pb-2">
                {p.sessions.map((s) => (
                  <li key={s.id} className="space-y-1 border-l-2 border-border pl-3">
                    <p className="text-sm tabular-nums">{formatProjectDate(s.startAt)}</p>
                    <p className="text-xs text-muted-foreground">
                      {PROJECT_APPOINTMENT_STATUS[s.status] ?? "Status não verificado"}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum agendamento vinculado disponível.
              </p>
            )}
          </details>
          <Button asChild variant="outline" className="min-h-11 w-full">
            <Link
              to="/projetos/$projectId"
              params={{ projectId: p.id }}
              search={{ status: "active" }}
            >
              Abrir projeto
            </Link>
          </Button>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Status comercial não verificado aqui. Leitura do espelho local; o histórico da consulta é
        preservado.
      </p>
      <p className="text-xs text-muted-foreground">
        Agendar novas sessões exige confirmação do vínculo com o projeto existente.
      </p>
    </section>
  );
}
