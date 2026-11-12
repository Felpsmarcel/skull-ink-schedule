import { describe, expect, it } from "vitest";
import {
  assertProjectPhotos,
  projectPhotoFileError,
  type ProjectPhoto,
} from "@/lib/project-photos-adapter";
const photo: ProjectPhoto = {
  id: "photo-a",
  projectId: "project-a",
  url: "blob:synthetic",
  kind: "before",
  caption: "Exemplo",
  createdAt: "2026-11-13T10:00:00Z",
};
describe("project photo contract", () => {
  it("rejects another project's photo instead of claiming successful upload or displaying it", () => {
    expect(() => assertProjectPhotos("project-b", [photo])).toThrow();
    expect(() => assertProjectPhotos("project-a", [photo, photo])).toThrow();
    expect(() => assertProjectPhotos("project-a", [photo])).not.toThrow();
  });
  it("accepts only nonempty JPG/PNG/WebP files within 10 MB", () => {
    expect(projectPhotoFileError({ type: "image/jpeg", size: 10_000_000 })).toBeNull();
    expect(projectPhotoFileError({ type: "image/svg+xml", size: 20 })).not.toBeNull();
    expect(projectPhotoFileError({ type: "image/png", size: 0 })).not.toBeNull();
    expect(projectPhotoFileError({ type: "image/webp", size: 10_000_001 })).not.toBeNull();
  });
});
