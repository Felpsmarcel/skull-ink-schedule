export type ProjectPhotoKind = "reference" | "before" | "progress" | "result";
export interface ProjectPhoto {
  id: string;
  projectId: string;
  url: string;
  caption: string;
  kind: ProjectPhotoKind;
  createdAt: string;
}
export type ProjectPhotosResult =
  | { kind: "disabled"; message: string }
  | { kind: "forbidden" }
  | { kind: "ready"; photos: ProjectPhoto[]; canUpload: boolean; canDelete: boolean };
export interface ProjectPhotosAdapter {
  environment: "live" | "fixture";
  load: (projectId: string) => Promise<ProjectPhotosResult>;
  upload?: (input: {
    projectId: string;
    file: File;
    kind: ProjectPhotoKind;
    caption: string;
    requestId: string;
  }) => Promise<{ photo: ProjectPhoto }>;
  remove?: (input: {
    projectId: string;
    photoId: string;
    requestId: string;
  }) => Promise<{ removedPhotoId: string }>;
}

export const PROJECT_PHOTO_KINDS: Record<ProjectPhotoKind, string> = {
  reference: "Referência",
  before: "Antes",
  progress: "Progresso",
  result: "Resultado",
};
export const PROJECT_PHOTO_MAX_BYTES = 10_000_000;
export const PROJECT_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export function projectPhotoFileError(file: Pick<File, "type" | "size">): string | null {
  if (!PROJECT_PHOTO_TYPES.includes(file.type)) return "Selecione uma imagem JPG, PNG ou WebP.";
  if (file.size <= 0) return "O arquivo está vazio.";
  if (file.size > PROJECT_PHOTO_MAX_BYTES) return "A imagem deve ter até 10 MB.";
  return null;
}

/** Fail closed: a result for another project must never be rendered or treated as saved. */
export function assertProjectPhotos(projectId: string, photos: ProjectPhoto[]) {
  const ids = new Set<string>();
  for (const photo of photos) {
    if (
      photo.projectId !== projectId ||
      !photo.id ||
      ids.has(photo.id) ||
      !Object.hasOwn(PROJECT_PHOTO_KINDS, photo.kind)
    ) {
      throw new Error("Não foi possível confirmar as fotos deste projeto.");
    }
    ids.add(photo.id);
  }
}
