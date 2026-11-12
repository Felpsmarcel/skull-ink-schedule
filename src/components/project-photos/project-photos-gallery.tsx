import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Camera, ImageOff, Images, Loader2, Plus, RefreshCw, Trash2, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatProjectDate } from "@/lib/project-journey-core";
import { createPhotoRequestGate } from "@/lib/photo-request-gate";
import {
  assertProjectPhotos,
  PROJECT_PHOTO_KINDS,
  projectPhotoFileError,
  type ProjectPhoto,
  type ProjectPhotoKind,
  type ProjectPhotosAdapter,
  type ProjectPhotosResult,
} from "@/lib/project-photos-adapter";

type LoadState = ProjectPhotosResult | { kind: "loading" } | { kind: "error" };
type Draft = { file: File; kind: ProjectPhotoKind; caption: string; requestId: string };
type Notice = { error: boolean; text: string };
type ProjectEditor = {
  adapter?: ProjectPhotosAdapter;
  draft?: Draft;
  editing: boolean;
  deleting?: ProjectPhoto;
  notice?: Notice;
};
const INITIAL_EDITOR: ProjectEditor = { editing: false };

/** No network or persistence of its own. The adapter must confirm every write by immutable ID. */
export function ProjectPhotosGallery({
  projectId,
  adapter,
}: {
  projectId: string;
  adapter: ProjectPhotosAdapter;
}) {
  const headingId = useId();
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<{
    projectId: string;
    adapter: ProjectPhotosAdapter;
    state: LoadState;
  }>({
    projectId,
    adapter,
    state: { kind: "loading" },
  });
  const [editors, setEditors] = useState<Record<string, ProjectEditor>>({});
  const editor = editors[projectId]?.adapter === adapter ? editors[projectId] : INITIAL_EDITOR;
  const [refresh, setRefresh] = useState(0);
  const [busyProjects, setBusyProjects] = useState<Record<string, boolean>>({});
  const locks = useRef(new Set<string>());
  const requestGate = useMemo(() => createPhotoRequestGate(), []);
  const [zoom, setZoom] = useState<{
    projectId: string;
    adapter: ProjectPhotosAdapter;
    photoId: string;
    trigger: HTMLButtonElement;
  } | null>(null);
  const state: LoadState =
    loaded.projectId === projectId && loaded.adapter === adapter
      ? loaded.state
      : { kind: "loading" };
  const zoomPhoto =
    zoom?.projectId === projectId && zoom.adapter === adapter && state.kind === "ready"
      ? state.photos.find((photo) => photo.id === zoom.photoId)
      : undefined;
  const busy = busyProjects[projectId] ?? false;
  const fixture = adapter.environment === "fixture";
  const canUpload = state.kind === "ready" && state.canUpload && Boolean(adapter.upload);
  const canDelete = state.kind === "ready" && state.canDelete && Boolean(adapter.remove);

  function updateEditor(id: string, update: (previous: ProjectEditor) => ProjectEditor) {
    setEditors((previous) => ({
      ...previous,
      [id]: {
        ...update(previous[id]?.adapter === adapter ? previous[id] : INITIAL_EDITOR),
        adapter,
      },
    }));
  }
  function notice(id: string, text: string, error = true) {
    updateEditor(id, (previous) => ({ ...previous, notice: { text, error } }));
  }
  const draftFile = editor.draft?.file;
  const [previewResource, setPreviewResource] = useState<{ file: File; url: string } | null>(null);
  const preview = previewResource?.file === draftFile ? previewResource?.url : null;
  useEffect(() => {
    if (!draftFile) return;
    const url = URL.createObjectURL(draftFile);
    setPreviewResource({ file: draftFile, url });
    return () => URL.revokeObjectURL(url);
  }, [draftFile]);

  useEffect(() => {
    const generation = requestGate.begin();
    setZoom(null);
    setLoaded({ projectId, adapter, state: { kind: "loading" } });
    adapter
      .load(projectId)
      .then((result) => {
        if (result.kind === "ready") assertProjectPhotos(projectId, result.photos);
        if (generation.isCurrent()) setLoaded({ projectId, adapter, state: result });
      })
      .catch(() => {
        if (generation.isCurrent()) setLoaded({ projectId, adapter, state: { kind: "error" } });
      });
    return () => {
      generation.end();
    };
  }, [projectId, adapter, refresh, requestGate]);

  function chooseFile(file: File | undefined) {
    if (!file || !canUpload || busy) return;
    const error = projectPhotoFileError(file);
    if (error) {
      notice(projectId, error);
      return;
    }
    updateEditor(projectId, () => ({
      editing: true,
      draft: { file, kind: "reference", caption: "", requestId: crypto.randomUUID() },
    }));
  }
  function changeDraft(update: Partial<Pick<Draft, "kind" | "caption">>) {
    if (busy) return;
    updateEditor(projectId, (previous) => ({
      ...previous,
      notice: undefined,
      draft: previous.draft
        ? { ...previous.draft, ...update, requestId: crypto.randomUUID() }
        : undefined,
    }));
  }
  async function upload() {
    const draft = editor.draft;
    const isCurrent = requestGate.capture();
    if (!canUpload || !draft || !adapter.upload || !isCurrent?.() || locks.current.has(projectId))
      return;
    const id = projectId;
    locks.current.add(id);
    setBusyProjects((previous) => ({ ...previous, [id]: true }));
    try {
      const result = await adapter.upload({
        projectId: id,
        file: draft.file,
        kind: draft.kind,
        caption: draft.caption.trim(),
        requestId: draft.requestId,
      });
      assertProjectPhotos(id, [result.photo]);
      if (!isCurrent()) return;
      setLoaded((previous) =>
        previous.projectId === id && previous.adapter === adapter && previous.state.kind === "ready"
          ? {
              projectId: id,
              adapter,
              state: {
                ...previous.state,
                photos: [
                  ...previous.state.photos.filter((photo) => photo.id !== result.photo.id),
                  result.photo,
                ],
              },
            }
          : previous,
      );
      updateEditor(id, () => ({
        editing: false,
        notice: {
          error: false,
          text: fixture
            ? "Foto adicionada somente à simulação. Nenhum arquivo foi enviado ao estúdio."
            : "Foto adicionada ao projeto.",
        },
      }));
    } catch {
      if (!isCurrent()) return;
      notice(
        id,
        "Não foi possível confirmar o envio. Sua foto e legenda continuam em revisão; tente novamente.",
      );
    } finally {
      locks.current.delete(id);
      setBusyProjects((previous) => ({ ...previous, [id]: false }));
    }
  }
  async function remove() {
    const photo = editor.deleting;
    const isCurrent = requestGate.capture();
    if (!canDelete || !photo || !adapter.remove || !isCurrent?.() || locks.current.has(projectId))
      return;
    const id = projectId;
    locks.current.add(id);
    setBusyProjects((previous) => ({ ...previous, [id]: true }));
    try {
      const result = await adapter.remove({
        projectId: id,
        photoId: photo.id,
        requestId: `remove-${photo.id}`,
      });
      if (result.removedPhotoId !== photo.id) throw new Error("Unexpected photo");
      if (!isCurrent()) return;
      setLoaded((previous) =>
        previous.projectId === id && previous.adapter === adapter && previous.state.kind === "ready"
          ? {
              projectId: id,
              adapter,
              state: {
                ...previous.state,
                photos: previous.state.photos.filter((item) => item.id !== photo.id),
              },
            }
          : previous,
      );
      updateEditor(id, (previous) => ({
        ...previous,
        deleting: undefined,
        notice: {
          error: false,
          text: fixture ? "Foto removida somente da simulação." : "Foto removida do projeto.",
        },
      }));
    } catch {
      if (!isCurrent()) return;
      notice(id, "Não foi possível confirmar a remoção. A foto continua na galeria.");
    } finally {
      locks.current.delete(id);
      setBusyProjects((previous) => ({ ...previous, [id]: false }));
    }
  }

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Images aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
            <h2 id={headingId} className="font-editorial text-2xl">
              Fotos do projeto
            </h2>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Referências e evolução, organizadas neste projeto.
          </p>
        </div>
        {canUpload ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl"
            disabled={busy}
            onClick={() =>
              editor.draft
                ? updateEditor(projectId, (previous) => ({ ...previous, editing: true }))
                : fileInput.current?.click()
            }
          >
            <Plus aria-hidden="true" className="h-4 w-4" />{" "}
            {editor.draft ? "Continuar revisão" : "Adicionar foto"}
          </Button>
        ) : null}
      </header>
      {fixture ? (
        <p
          role="note"
          className="rounded-xl border border-primary/20 bg-accent/50 p-3 text-xs leading-5"
        >
          DEMONSTRAÇÃO · Imagens e alterações apenas nesta simulação. Sem envio ao CRM ou
          armazenamento do estúdio.
        </p>
      ) : null}
      <input
        ref={fileInput}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={!canUpload || busy}
        onChange={(event) => {
          chooseFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {editor.notice && !editor.editing && !editor.deleting ? (
        <p
          role={editor.notice.error ? "alert" : "status"}
          className={`rounded-xl border p-3 text-sm leading-6 ${editor.notice.error ? "border-destructive/25 bg-destructive/5 text-destructive" : "border-border bg-muted/30 text-foreground"}`}
        >
          {editor.notice.text}
        </p>
      ) : null}
      {state.kind === "loading" ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-muted/30 p-5 text-sm text-muted-foreground"
        >
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />{" "}
          Carregando fotos…
        </p>
      ) : null}
      {state.kind === "disabled" ? (
        <PhotoState title="Ativação pendente" detail={state.message} />
      ) : null}
      {state.kind === "forbidden" ? (
        <PhotoState
          title="Fotos indisponíveis para este acesso"
          detail="A galeria só pode ser consultada por pessoas autorizadas neste projeto."
        />
      ) : null}
      {state.kind === "error" ? (
        <PhotoState
          title="Não foi possível carregar as fotos"
          detail="A leitura falhou. Isso não significa que o projeto esteja sem fotos."
          action={
            <Button
              type="button"
              variant="outline"
              className="mt-3 min-h-11 rounded-xl"
              onClick={() => setRefresh((n) => n + 1)}
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" /> Tentar novamente
            </Button>
          }
        />
      ) : null}
      {state.kind === "ready" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              {state.photos.length}{" "}
              {state.photos.length === 1 ? "foto neste projeto" : "fotos neste projeto"}
            </p>
            {!canUpload ? (
              <p>Visualização disponível · envio não liberado</p>
            ) : (
              <p>JPG, PNG ou WebP · até 10 MB</p>
            )}
          </div>
          {!state.photos.length ? (
            <PhotoState
              title="A história visual começa aqui"
              detail={
                canUpload
                  ? "Adicione uma referência ou uma foto da etapa atual. Você poderá revisar a imagem e a legenda antes de enviar."
                  : "Nenhuma foto foi cadastrada neste projeto."
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {state.photos.map((photo) => (
                <li
                  key={photo.id}
                  className="min-w-0 overflow-hidden rounded-xl border border-border bg-background"
                >
                  <button
                    type="button"
                    className="group relative block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    aria-label={`Ampliar foto: ${photo.caption || PROJECT_PHOTO_KINDS[photo.kind]}`}
                    onClick={(event) =>
                      setZoom({
                        projectId,
                        adapter,
                        photoId: photo.id,
                        trigger: event.currentTarget,
                      })
                    }
                  >
                    <PhotoImage
                      key={`${photo.id}:${photo.url}`}
                      src={photo.url}
                      alt={
                        photo.caption || `Foto de ${PROJECT_PHOTO_KINDS[photo.kind].toLowerCase()}`
                      }
                      className="aspect-[4/3] w-full object-contain bg-muted/35"
                    />
                    <span className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/95 text-foreground">
                      <ZoomIn aria-hidden="true" className="h-4 w-4" />
                    </span>
                  </button>
                  <div className="space-y-2 p-3">
                    <p className="text-xs font-semibold text-primary">
                      {PROJECT_PHOTO_KINDS[photo.kind]}
                    </p>
                    <p className="break-words text-sm leading-6">
                      {photo.caption || "Sem legenda"}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Adicionada {formatProjectDate(photo.createdAt)}
                    </p>
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11 px-2 text-xs text-muted-foreground hover:text-destructive"
                        disabled={busy}
                        aria-label={`Remover foto: ${photo.caption || PROJECT_PHOTO_KINDS[photo.kind]}`}
                        onClick={() =>
                          updateEditor(projectId, (previous) => ({
                            ...previous,
                            deleting: photo,
                            notice: undefined,
                          }))
                        }
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" /> Remover
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      <Dialog
        open={editor.editing && Boolean(editor.draft) && canUpload}
        onOpenChange={(open) => {
          if (!busy) updateEditor(projectId, (previous) => ({ ...previous, editing: open }));
        }}
      >
        <DialogContent
          closeLabel="Fechar revisão"
          className="max-h-[90dvh] w-[calc(100%_-_1.5rem)] max-w-xl overflow-y-auto rounded-2xl p-4 sm:p-6 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center [&>button]:right-2 [&>button]:top-2 motion-reduce:animate-none"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <DialogHeader className="pr-9">
            <DialogTitle>Revisar foto</DialogTitle>
            <DialogDescription>
              {fixture
                ? "Prévia local: a confirmação adiciona a imagem apenas à simulação."
                : "Confira a imagem e organize a etapa antes de enviar."}
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <img
              src={preview}
              alt="Prévia da imagem selecionada para este projeto"
              className="max-h-[32dvh] w-full rounded-xl border border-border bg-muted/30 object-contain"
            />
          ) : null}
          <p className="break-all text-xs text-muted-foreground">{editor.draft?.file.name}</p>
          <div className="space-y-2">
            <Label htmlFor={`${inputId}-kind`}>Tipo da foto</Label>
            <select
              id={`${inputId}-kind`}
              value={editor.draft?.kind ?? "reference"}
              disabled={busy}
              className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => changeDraft({ kind: event.target.value as ProjectPhotoKind })}
            >
              {Object.entries(PROJECT_PHOTO_KINDS).map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${inputId}-caption`}>
              Legenda <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id={`${inputId}-caption`}
              value={editor.draft?.caption ?? ""}
              disabled={busy}
              maxLength={500}
              className="min-h-11 rounded-xl"
              onChange={(event) => changeDraft({ caption: event.target.value })}
              placeholder="O que esta imagem registra?"
            />
          </div>
          {editor.notice?.error ? (
            <p role="alert" className="text-sm leading-6 text-destructive">
              {editor.notice.text}
            </p>
          ) : null}
          <p className="text-xs leading-5 text-muted-foreground">
            Enquanto estiver em revisão, a imagem fica apenas nesta tela. Fechar mantém o rascunho
            deste projeto; recarregar descarta o rascunho.
          </p>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              className="min-h-11 rounded-xl"
              onClick={() => updateEditor(projectId, () => ({ editing: false }))}
            >
              Descartar
            </Button>
            <Button
              type="button"
              disabled={busy || !editor.draft}
              className="min-h-11 rounded-xl"
              onClick={upload}
            >
              {busy ? (
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Camera aria-hidden="true" className="h-4 w-4" />
              )}
              {busy ? "Confirmando…" : fixture ? "Adicionar à simulação" : "Enviar foto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {zoomPhoto && zoom ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setZoom(null);
          }}
        >
          <DialogContent
            closeLabel="Fechar foto"
            className="max-h-[94dvh] w-[calc(100%_-_1.5rem)] max-w-4xl overflow-y-auto rounded-2xl p-4 sm:p-6 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center [&>button]:right-2 [&>button]:top-2 motion-reduce:animate-none"
            onCloseAutoFocus={(event) => {
              if (zoom.trigger.isConnected) {
                event.preventDefault();
                zoom.trigger.focus();
              }
            }}
          >
            <DialogHeader className="pr-9">
              <DialogTitle>{PROJECT_PHOTO_KINDS[zoomPhoto.kind]}</DialogTitle>
              <DialogDescription className="break-words">
                {zoomPhoto.caption || "Visualização ampliada da foto do projeto."}
              </DialogDescription>
            </DialogHeader>
            <PhotoImage
              key={`${zoomPhoto.id}:${zoomPhoto.url}`}
              src={zoomPhoto.url}
              alt={zoomPhoto.caption || "Foto do projeto ampliada"}
              className="max-h-[70dvh] w-full rounded-xl bg-muted/30 object-contain"
            />
            <DialogClose asChild>
              <Button type="button" variant="outline" className="min-h-11 rounded-xl">
                Fechar
              </Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog
        open={Boolean(editor.deleting) && canDelete}
        onOpenChange={(open) => {
          if (!open && !busy)
            updateEditor(projectId, (previous) => ({ ...previous, deleting: undefined }));
        }}
      >
        <DialogContent
          closeLabel="Fechar confirmação"
          className="max-h-[90dvh] w-[calc(100%_-_1.5rem)] overflow-y-auto rounded-2xl p-5 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center [&>button]:right-2 [&>button]:top-2 motion-reduce:animate-none"
        >
          <DialogHeader className="pr-9">
            <DialogTitle>Remover esta foto?</DialogTitle>
            <DialogDescription className="break-words">
              {fixture
                ? "A remoção altera somente esta simulação."
                : "A foto será removida deste projeto após a confirmação."}{" "}
              {editor.deleting?.caption || "Foto sem legenda."}
            </DialogDescription>
          </DialogHeader>
          {editor.notice?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {editor.notice.text}
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              className="min-h-11 rounded-xl"
              onClick={() =>
                updateEditor(projectId, (previous) => ({ ...previous, deleting: undefined }))
              }
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              className="min-h-11 rounded-xl"
              onClick={remove}
            >
              {busy ? "Confirmando…" : "Confirmar remoção"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PhotoState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center">
      <Images aria-hidden="true" className="mx-auto h-7 w-7 text-muted-foreground" />
      <h3 className="mt-3 text-base font-medium">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{detail}</p>
      {action}
    </div>
  );
}
function PhotoImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span
        role="img"
        aria-label={`${alt}: imagem indisponível`}
        className="flex aspect-[4/3] w-full items-center justify-center gap-2 bg-muted/30 p-4 text-sm text-muted-foreground"
      >
        <ImageOff aria-hidden="true" className="h-5 w-5" /> Imagem indisponível
      </span>
    );
  return (
    <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />
  );
}
