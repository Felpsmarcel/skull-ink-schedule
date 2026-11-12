import { useEffect, useMemo, useState } from "react";
import { ProjectPhotosGallery } from "../../src/components/project-photos/project-photos-gallery";
import { PageHeader } from "../../src/components/ui/page-header";
import {
  createPhotosDemoStore,
  PHOTO_DEMO_PROJECTS as PROJECTS,
  type PhotosDemoMode as Mode,
} from "./photos-fixture";
const MODES: Record<Mode, string> = {
  ready: "Galeria disponível",
  empty: "Galeria vazia",
  error: "Falha de leitura",
  forbidden: "Sem permissão",
  disabled: "Ativação pendente",
  readOnly: "Somente leitura",
  uploadError: "Falha de envio",
  deleteError: "Falha de remoção",
};
/** Isolated local fixture. It never imports server functions, auth, CRM or storage clients. */
export function PhotosDemo() {
  const [projectId, setProjectId] = useState<string>(PROJECTS[0].id);
  const [mode, setMode] = useState<Mode>("ready");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const store = useMemo(() => createPhotosDemoStore(), []);
  useEffect(() => () => store.dispose(), [store]);
  const adapter = useMemo(() => store.adapter(mode, setConfirmation), [mode, store]);

  return (
    <>
      <PageHeader
        eyebrow="GF Tattoo Studio · prévia local"
        title="Fotos do projeto"
        description="Galeria, revisão e permissões com dados de exemplo"
      />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 pb-28 sm:px-6">
        <p
          role="note"
          className="rounded-xl border border-primary/20 bg-accent/45 p-4 text-sm leading-6"
        >
          Ensaio local sem autenticação, CRM ou Storage. As imagens iniciais são arquivos da marca
          GF, não tatuagens nem clientes. Arquivos selecionados por você ficam apenas na memória
          desta prévia e são descartados ao recarregar ou sair dela.
        </p>
        <section
          aria-label="Controles da demonstração de fotos"
          className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2"
        >
          <label className="space-y-2 text-sm">
            <span className="block text-xs font-medium text-muted-foreground">
              Projeto de exemplo
            </span>
            <select
              aria-label="Projeto de exemplo"
              value={projectId}
              className="min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => {
                setProjectId(event.target.value);
                setConfirmation(null);
              }}
            >
              {PROJECTS.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="block text-xs font-medium text-muted-foreground">
              Cenário da galeria
            </span>
            <select
              aria-label="Cenário da galeria"
              value={mode}
              className="min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => {
                setMode(event.target.value as Mode);
                setConfirmation(null);
              }}
            >
              {Object.entries(MODES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </section>
        <p className="text-xs leading-5 text-muted-foreground">
          Os cenários são independentes. Dentro de cada cenário, Projeto A e Projeto B têm galerias
          separadas. Fechar a revisão conserva o rascunho do respectivo projeto enquanto esta tela
          estiver aberta.
        </p>
        {confirmation ? (
          <p role="status" className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
            {confirmation}
          </p>
        ) : null}
        <ProjectPhotosGallery projectId={projectId} adapter={adapter} />
      </main>
    </>
  );
}
