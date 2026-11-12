import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Building2, Loader2, Plus, User } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/ui/error-state";
import {
  WizardStepMain,
  WizardSection,
  WizardOptionCard as OptionCard,
} from "@/components/appointment-wizard/wizard-layout";
import { WizardFooter } from "@/components/appointment-wizard/wizard-footer";
import { useAppointmentDraft } from "@/stores/appointment-draft";
import { lookupProjectContext } from "@/lib/projects.functions";
import { PROJECT_TYPE_LABELS, type ProjectType } from "@/lib/linking";

export const Route = createFileRoute("/_authenticated/appointments/new/projeto")({
  head: () => ({
    meta: [
      { title: "Projeto e oportunidade — Novo agendamento" },
      {
        name: "description",
        content: "Vincular o agendamento ao projeto e à oportunidade do CRM.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ProjetoStep,
});

function ProjetoStep() {
  const navigate = useNavigate();
  const draft = useAppointmentDraft();
  const contact = draft.contact;
  const lookup = useServerFn(lookupProjectContext);

  const ctxQ = useQuery({
    queryKey: ["project-context", contact?.id ?? "none"],
    enabled: Boolean(contact),
    staleTime: 60_000,
    queryFn: () =>
      lookup({
        data: {
          ghlContactId: contact?.id ?? null,
          phone: contact?.phone ?? null,
          email: contact?.email ?? null,
          name:
            contact?.contactName ??
            [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") ??
            null,
        },
      }),
  });

  const ctx = ctxQ.data;
  const p = draft.project;
  const chosen =
    p.decision === "reuse"
      ? (p.reuseProjectId ?? p.reuseOpportunityId ?? null)
      : p.decision === "new"
        ? "new"
        : null;

  function chooseProject(projectId: string, opportunityId: string | null) {
    draft.setProject({
      decision: "reuse",
      reuseProjectId: projectId,
      reuseOpportunityId: opportunityId,
    });
  }

  function chooseOpportunity(opportunityId: string) {
    draft.setProject({
      decision: "reuse",
      reuseProjectId: null,
      reuseOpportunityId: opportunityId,
    });
  }

  function chooseNew() {
    draft.setProject({ decision: "new", reuseProjectId: null, reuseOpportunityId: null });
  }

  if (!contact) {
    return (
      <>
        <WizardStepMain title="Escolha um projeto">
          <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Escolha primeiro o cliente para vermos o contacto e as oportunidades no CRM.
          </p>
        </WizardStepMain>
        <WizardFooter
          primary="Escolher cliente"
          onPrimary={() => navigate({ to: "/appointments/new/cliente" })}
        />
      </>
    );
  }

  return (
    <>
      <WizardStepMain
        title="Projeto e oportunidade"
        description="Associe o agendamento ao projeto do cliente e à oportunidade correspondente."
      >
        <WizardSection className="text-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Contacto no CRM</h3>
          {ctxQ.isLoading ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> A procurar no CRM…
            </p>
          ) : ctxQ.error ? (
            <ErrorState
              description="Não foi possível verificar o contacto e os projetos."
              onRetry={() => {
                void ctxQ.refetch();
              }}
            />
          ) : ctx?.contact ? (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <div className="break-words font-medium">{ctx.contact.name ?? "Sem nome"}</div>
                <div className="break-all text-xs text-muted-foreground">
                  {ctx.contact.phone ?? ctx.contact.email ?? ctx.contact.id}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Contacto novo — será usado o contacto selecionado no passo anterior.
            </p>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" /> Pipeline: GF Tattoo — Jornada Comercial
          </p>
          {ctx?.warning ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs leading-5 text-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {ctx.warning}
            </p>
          ) : null}
        </WizardSection>

        {(ctx?.projects.length ?? 0) > 0 ? (
          <WizardSection>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Projetos deste cliente</h3>
            <ul className="space-y-2">
              {ctx!.projects.map((pr) => (
                <li key={pr.id}>
                  <OptionCard
                    active={chosen === pr.id}
                    onClick={() => chooseProject(pr.id, pr.ghlOpportunityId)}
                    title={pr.title}
                    subtitle={`${PROJECT_TYPE_LABELS[pr.projectType as ProjectType] ?? pr.projectType} · ${pr.status}${
                      pr.ghlOpportunityId ? " · oportunidade ligada" : " · sem oportunidade"
                    }`}
                    right={`${pr.quotedTotalEur.toFixed(2)} €`}
                  />
                </li>
              ))}
            </ul>
          </WizardSection>
        ) : null}

        {(ctx?.openOpportunities.length ?? 0) > 0 ? (
          <WizardSection>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Oportunidades abertas no pipeline
            </h3>
            <ul className="space-y-2">
              {ctx!.openOpportunities.map((o) => (
                <li key={o.id}>
                  <OptionCard
                    active={
                      chosen === o.id || (o.localProjectId != null && chosen === o.localProjectId)
                    }
                    onClick={() =>
                      o.localProjectId
                        ? chooseProject(o.localProjectId, o.id)
                        : chooseOpportunity(o.id)
                    }
                    title={o.name ?? o.id}
                    subtitle={`Usar oportunidade existente${o.localProjectId ? " (projeto já vinculado)" : ""}`}
                    right={o.monetaryValue != null ? `${o.monetaryValue.toFixed(2)} €` : undefined}
                  />
                </li>
              ))}
            </ul>
          </WizardSection>
        ) : null}

        <WizardSection>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Novo projeto</h3>
          <OptionCard
            active={chosen === "new"}
            onClick={chooseNew}
            icon={<Plus className="h-4 w-4" />}
            title="Criar novo projeto e oportunidade"
            subtitle="A criação acontece ao finalizar o agendamento, depois da revisão."
          />

          {chosen === "new" ? (
            <div className="mt-5 space-y-4 border-t border-border pt-5">
              <div>
                <Label htmlFor="wizard-project-type" className="text-sm text-muted-foreground">
                  Tipo de projeto
                </Label>
                <Select
                  value={p.projectType}
                  onValueChange={(v) => draft.setProject({ projectType: v as ProjectType })}
                >
                  <SelectTrigger id="wizard-project-type" className="mt-2 h-12 rounded-xl text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {PROJECT_TYPE_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="bodyPart" className="text-xs text-muted-foreground">
                  Zona do corpo
                </Label>
                <Input
                  id="bodyPart"
                  value={p.bodyPart}
                  onChange={(e) => draft.setProject({ bodyPart: e.target.value.slice(0, 120) })}
                  placeholder="Ex.: antebraço direito"
                  className="mt-2 h-12 rounded-xl text-sm"
                />
              </div>
              <div>
                <Label htmlFor="projDesc" className="text-xs text-muted-foreground">
                  Descrição do projeto
                </Label>
                <Textarea
                  id="projDesc"
                  rows={3}
                  value={p.description}
                  onChange={(e) => draft.setProject({ description: e.target.value.slice(0, 2000) })}
                  placeholder="Ideia, referências, número de sessões previstas…"
                  className="mt-2 rounded-xl"
                />
              </div>
            </div>
          ) : null}
        </WizardSection>
      </WizardStepMain>

      <WizardFooter
        showBack
        primary="Continuar"
        primaryDisabled={p.decision === null}
        onPrimary={() => navigate({ to: "/appointments/new/agenda" })}
      />
    </>
  );
}
