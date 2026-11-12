import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getProjectPhotosAvailability } from "@/lib/project-photos.functions";
import type { ProjectPhotosAdapter } from "@/lib/project-photos-adapter";
import { ProjectPhotosGallery } from "./project-photos-gallery";

export function ProjectPhotos({
  projectId,
  adapter,
}: {
  projectId: string;
  adapter?: ProjectPhotosAdapter;
}) {
  const read = useServerFn(getProjectPhotosAvailability);
  const live = useMemo<ProjectPhotosAdapter>(
    () => ({ environment: "live", load: (id) => read({ data: { projectId: id } }) }),
    [read],
  );
  return <ProjectPhotosGallery projectId={projectId} adapter={adapter ?? live} />;
}
