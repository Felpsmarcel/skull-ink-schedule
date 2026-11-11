import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { ArrowLeft, ArrowUpRight, CalendarDays } from "lucide-react";
import { getArtistPanel } from "@/lib/artist-panel.functions";
import { type PanelAppointment } from "@/lib/artist-panel-core";
import { formatProjectDate, PROJECT_APPOINTMENT_STATUS } from "@/lib/project-journey-core";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const searchSchema = z.object({ artist: z.string().uuid().optional(), days: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(60) });
const panelQuery = (artist: string | undefined, days: 30 | 60 | 90) => queryOptions({ queryKey: ["artist-panel", artist, days], queryFn: () => getArtistPanel({ data: { artistId: artist, horizon: days } }), retry: false });

export const Route = createFileRoute("/_authenticated/painel-tatuador")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ artist: search.artist, days: search.days }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(panelQuery(deps.artist, deps.days)),
  head: () => ({ meta: [
    { title: "Painel do tatuador · GF Tattoo Studio" },
    { name: "description", content: "Agenda, projetos e continuidade por tatuador, em leitura administrativa." },
    { property: "og:title", content: "Painel do tatuador · GF Tattoo Studio" },
    { property: "og:description", content: "Acompanhamento de agendamentos e projetos do GF Tattoo Studio." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: ArtistPanelPage,
  pendingComponent: () => <p role="status" className="p-6 text-sm">Carregando painel…</p>,
  errorComponent: PanelError,
  notFoundComponent: () => <p className="p-6 text-sm">Painel indisponível.</p>,
});

function ArtistPanelPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(panelQuery(search.artist, search.days));
  const projects = data.projects;
  const attention = projects?.filter((p) => p.continuity.future === 0) ?? null;
  return <main className="mx-auto max-w-6xl space-y-7 px-4 pb-28 pt-4 sm:px-8">
    <header className="space-y-4 border-b border-border pb-5">
      <Link to="/home" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Hoje</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-medium text-muted-foreground">Acompanhamento do tatuador · acesso administrativo</p><h1 className="mt-1 font-editorial text-3xl">{data.artist.name}</h1><p className="mt-2 text-sm text-muted-foreground">Agenda e continuidade dos projetos</p></div>
        <div className="grid w-full grid-cols-2 gap-3 sm:w-96">
          <Select value={data.artist.id} onValueChange={(artist) => navigate({ search: (prev) => ({ ...prev, artist }) })}><SelectTrigger aria-label="Tatuador"><SelectValue /></SelectTrigger><SelectContent>{data.artists.map((a) => <SelectItem key={a.id} value={a.id} className="min-h-11">{a.name}</SelectItem>)}</SelectContent></Select>
          <Select value={String(search.days)} onValueChange={(value) => { const days = Number(value); if (days === 30 || days === 60 || days === 90) navigate({ search: (prev) => ({ ...prev, days }) }); }}><SelectTrigger aria-label="Horizonte da agenda"><SelectValue /></SelectTrigger><SelectContent>{[30,60,90].map((days) => <SelectItem key={days} value={String(days)} className="min-h-11">{days} dias</SelectItem>)}</SelectContent></Select>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">Prévia de gestão: acesso do artista bloqueado até revisão das permissões e homologação. Espelho local, não lista integral do GHL. Atualizado {formatProjectDate(data.updatedAt)} · Europe/Brussels.</p>
    </header>

    <dl className="grid grid-cols-2 gap-y-5 border-b border-border pb-6 sm:grid-cols-4">
      <Metric label="Agendamentos hoje" value={data.today?.length ?? null} />
      <Metric label={`Próximos ${search.days} dias`} value={data.upcoming?.length ?? null} />
      <Metric label="Projetos ativos" value={projects?.length ?? null} />
      <Metric label="Sem próxima data" value={projects && projects.every((p) => p.continuity.future !== null) ? attention?.length ?? null : null} />
    </dl>
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-3"><h2 className="font-editorial text-xl">Hoje</h2><p className="text-xs text-muted-foreground">Horário previsto não comprova presença ou início do atendimento.</p><AppointmentList rows={data.today} empty="Nenhum agendamento local hoje." now /></section>
      <section className="space-y-3"><h2 className="font-editorial text-xl">Próximos compromissos</h2><AppointmentList rows={data.upcoming} empty="Nenhum próximo compromisso neste período." /></section>
    </div>
    <section className="space-y-4 border-t border-border pt-6">
      <h2 className="font-editorial text-xl">Projetos e próximos retornos</h2>
      <p className="text-xs leading-5 text-muted-foreground">Agendamentos vinculados, não classificação automática de sessões de tatuagem. Coberturas confirmadas: a verificar — o tipo cadastrado pode ser um padrão não confirmado. Status comercial não verificado aqui.</p>
      {projects === null ? <Unavailable /> : projects.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum projeto ativo local para este tatuador.</p> : <ul className="grid gap-4 sm:grid-cols-2">{projects.map((p) => <li key={p.id} className="min-w-0 rounded-md border border-border bg-card p-4">
        <Link to="/projetos/$projectId" params={{ projectId: p.id }} className="flex min-h-11 items-start justify-between gap-3 text-base font-semibold hover:underline"><span className="break-words">{p.title}</span><ArrowUpRight className="mt-1 h-4 w-4 shrink-0" /></Link>
        <p className="mt-2 text-sm">{p.continuity.linked ?? "A verificar"} vinculados · {p.continuity.done ?? "A verificar"} conclusões registradas · {p.continuity.future ?? "A verificar"} futuros</p>
        <p className="mt-3 text-sm font-medium">{p.continuity.next ? `Próxima data: ${formatProjectDate(p.continuity.next)}` : p.continuity.future === null ? "Continuidade indisponível" : "Sem próxima sessão marcada"}</p>
        {!p.continuity.next ? <p className="mt-1 text-xs text-muted-foreground">Continuidade a verificar; não comprova abandono ou conclusão.</p> : null}
        {p.dates ? <ol className="mt-3 space-y-2 border-t border-border pt-3">{p.dates.map((a) => <li key={a.id} className="text-xs leading-5 text-muted-foreground">{formatProjectDate(a.startAt)} · {PROJECT_APPOINTMENT_STATUS[a.status] ?? "A verificar"}</li>)}</ol> : <Unavailable />}
      </li>)}</ul>}
    </section>
  </main>;
}

function AppointmentList({ rows, empty, now = false }: { rows: PanelAppointment[] | null; empty: string; now?: boolean }) {
  if (rows === null) return <Unavailable />;
  if (!rows.length) return <p className="py-4 text-sm text-muted-foreground">{empty}</p>;
  return <ol className="divide-y divide-border">{rows.map((a) => <li key={a.id} className="py-3">
    <Link to="/agenda" search={a.ghlId ? { novo: a.ghlId } : {}} className="flex min-h-11 items-center justify-between gap-3 hover:underline"><div className="min-w-0"><p className="break-words text-sm font-semibold">{a.name}</p><p className="mt-1 text-xs text-muted-foreground">{formatProjectDate(a.startAt)}</p></div><CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>
    <p className="mt-1 text-xs text-muted-foreground">{PROJECT_APPOINTMENT_STATUS[a.status] ?? "Status não verificado"}{now && Date.parse(a.startAt) <= Date.now() && Date.parse(a.endAt) > Date.now() ? " · No horário previsto" : ""} · Presença a verificar</p>
  </li>)}</ol>;
}
function Metric({ label, value }: { label: string; value: number | null }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{value ?? "Indisponível"}</dd></div>; }
function Unavailable() { return <p role="alert" className="py-3 text-sm text-muted-foreground">Fonte indisponível. Não representa zero.</p>; }
function PanelError() { const router = useRouter(); return <main role="alert" className="mx-auto max-w-xl space-y-4 p-6"><h1 className="font-editorial text-2xl">Painel indisponível</h1><p className="text-sm">Acesso exclusivo do administrador nesta prévia. Outros perfis não recebem dados; falhas de leitura também podem impedir a abertura.</p><Button variant="outline" className="min-h-11" onClick={() => router.invalidate()}>Tentar novamente</Button><Link to="/home" className="flex min-h-11 items-center text-sm">Voltar para Hoje</Link></main>; }