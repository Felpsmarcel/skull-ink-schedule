import {
  projectPhotoFileError,
  type ProjectPhoto,
  type ProjectPhotosAdapter,
} from "../../src/lib/project-photos-adapter";
import gfMark from "../../src/assets/gf-mark.png";
import gfLogo from "../../src/assets/gf-logo-official.png";

export type PhotosDemoMode =
  | "ready"
  | "empty"
  | "error"
  | "forbidden"
  | "disabled"
  | "readOnly"
  | "uploadError"
  | "deleteError";
export const PHOTO_DEMO_PROJECTS = [
  { id: "photos-project-a", label: "Projeto A · Exemplo" },
  { id: "photos-project-b", label: "Projeto B · Exemplo" },
] as const;

/** Local-only store shared by the visual fixture and isolated contract tests. */
export function createPhotosDemoStore() {
  const repositories: Record<string, ProjectPhoto[]> = {};
  const replayedUploads = new Map<string, ProjectPhoto>();
  const removedPhotos = new Set<string>();
  const localUrls = new Set<string>();
  const isProject = (id: string) => PHOTO_DEMO_PROJECTS.some((project) => project.id === id);
  return {
    dispose: () => {
      for (const url of localUrls) URL.revokeObjectURL(url);
      localUrls.clear();
    },
    adapter(
      mode: PhotosDemoMode,
      onConfirmed: (message: string) => void = () => {},
    ): ProjectPhotosAdapter {
      const scope = (id: string) => `${mode}:${id}`;
      function repository(id: string) {
        if (!isProject(id)) throw new Error("Projeto de exemplo não autorizado");
        const key = scope(id);
        repositories[key] ??=
          mode === "empty"
            ? []
            : [
                {
                  id: `${key}:brand-sample`,
                  projectId: id,
                  url: id === PHOTO_DEMO_PROJECTS[0].id ? gfMark : gfLogo,
                  caption: `Amostra da marca GF · Projeto ${id === PHOTO_DEMO_PROJECTS[0].id ? "A" : "B"}. Não é uma foto de cliente ou tatuagem.`,
                  kind: "reference",
                  createdAt: "2026-11-13T10:00:00Z",
                },
              ];
        return repositories[key];
      }
      const label = (id: string) => (id === PHOTO_DEMO_PROJECTS[0].id ? "Projeto A" : "Projeto B");
      return {
        environment: "fixture",
        load: async (id) => {
          if (!isProject(id) || mode === "forbidden") return { kind: "forbidden" };
          if (mode === "error") throw new Error("Falha sintética de leitura");
          if (mode === "disabled")
            return {
              kind: "disabled",
              message:
                "Cenário de teste: o armazenamento remoto não está ativado. Não é possível enviar ou remover fotos neste estado.",
            };
          return {
            kind: "ready",
            photos: [...repository(id)],
            canUpload: mode !== "readOnly",
            canDelete: mode !== "readOnly",
          };
        },
        upload: async ({ projectId: id, file, kind, caption, requestId }) => {
          const records = repository(id);
          if (mode === "uploadError")
            throw new Error("Falha sintética antes da confirmação de envio");
          if (["readOnly", "disabled", "forbidden", "error"].includes(mode))
            throw new Error("Envio não autorizado no cenário");
          const error = projectPhotoFileError(file);
          if (error) throw new Error(error);
          const key = `${scope(id)}:${requestId}`;
          const replay = replayedUploads.get(key);
          if (replay) return { photo: replay };
          const url = URL.createObjectURL(file);
          localUrls.add(url);
          const photo: ProjectPhoto = {
            id: `local-photo-${crypto.randomUUID()}`,
            projectId: id,
            url,
            kind,
            caption,
            createdAt: new Date().toISOString(),
          };
          repositories[scope(id)] = [...records, photo];
          replayedUploads.set(key, photo);
          onConfirmed(`Envio confirmado apenas na simulação de ${label(id)}.`);
          return { photo };
        },
        remove: async ({ projectId: id, photoId }) => {
          const records = repository(id);
          if (mode === "deleteError")
            throw new Error("Falha sintética antes da confirmação de remoção");
          if (["readOnly", "disabled", "forbidden", "error"].includes(mode))
            throw new Error("Remoção não autorizada no cenário");
          const photo = records.find((item) => item.id === photoId && item.projectId === id);
          const removalKey = `${scope(id)}:${photoId}`;
          if (!photo && !removedPhotos.has(removalKey))
            throw new Error("Foto não encontrada neste projeto");
          if (photo) {
            repositories[scope(id)] = records.filter((item) => item.id !== photoId);
            removedPhotos.add(removalKey);
          }
          if (photo && localUrls.has(photo.url)) {
            URL.revokeObjectURL(photo.url);
            localUrls.delete(photo.url);
          }
          onConfirmed(`Remoção confirmada apenas na simulação de ${label(id)}.`);
          return { removedPhotoId: photoId };
        },
      };
    },
  };
}
