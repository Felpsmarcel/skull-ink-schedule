import { afterEach, describe, expect, it, vi } from "vitest";
import { createPhotosDemoStore, PHOTO_DEMO_PROJECTS } from "../visual/photos-fixture";
import type { ProjectPhotosAdapter } from "@/lib/project-photos-adapter";
const [A, B] = PHOTO_DEMO_PROJECTS.map((project) => project.id);
const stores: ReturnType<typeof createPhotosDemoStore>[] = [];
const create = () => {
  const store = createPhotosDemoStore();
  stores.push(store);
  return store;
};
afterEach(() => {
  for (const store of stores.splice(0)) store.dispose();
});
async function photos(adapter: ProjectPhotosAdapter, project: string) {
  const result = await adapter.load(project);
  if (result.kind !== "ready") throw new Error("Not ready");
  return result.photos;
}
const input = (projectId: string, requestId = "one") => ({
  projectId,
  requestId,
  file: new File(["synthetic image bytes"], "sample.png", { type: "image/png" }),
  kind: "before" as const,
  caption: "Somente teste",
});

describe("local photo fixture", () => {
  it("keeps A/B isolated through deletion and rejects another project's photo ID", async () => {
    const confirmed = vi.fn();
    const adapter = create().adapter("ready", confirmed);
    const a = (await photos(adapter, A))[0];
    const b = (await photos(adapter, B))[0];
    await expect(
      adapter.remove!({ projectId: A, photoId: b.id, requestId: "wrong" }),
    ).rejects.toThrow();
    expect(confirmed).not.toHaveBeenCalled();
    await adapter.remove!({ projectId: A, photoId: a.id, requestId: "remove-a" });
    expect(await photos(adapter, A)).toHaveLength(0);
    expect(await photos(adapter, B)).toHaveLength(1);
    expect(confirmed).toHaveBeenCalledTimes(1);
  });
  it("confirms upload only after local insertion and deduplicates stable request IDs", async () => {
    const confirmed = vi.fn();
    const adapter = create().adapter("empty", confirmed);
    const first = await adapter.upload!(input(A));
    const replay = await adapter.upload!(input(A));
    expect(replay.photo.id).toBe(first.photo.id);
    expect(await photos(adapter, A)).toHaveLength(1);
    expect(await photos(adapter, B)).toHaveLength(0);
    expect(confirmed).toHaveBeenCalledTimes(1);
  });
  it("upload and removal failures leave records unchanged without success confirmation", async () => {
    const confirmed = vi.fn();
    const store = create();
    const upload = store.adapter("uploadError", confirmed);
    const before = await photos(upload, A);
    await expect(upload.upload!(input(A))).rejects.toThrow();
    expect(await photos(upload, A)).toEqual(before);
    const remove = store.adapter("deleteError", confirmed);
    const photo = (await photos(remove, A))[0];
    await expect(
      remove.remove!({ projectId: A, photoId: photo.id, requestId: "delete" }),
    ).rejects.toThrow();
    expect(await photos(remove, A)).toHaveLength(1);
    expect(confirmed).not.toHaveBeenCalled();
  });
  it("read-only/disabled/forbidden cannot write and unknown projects have no read access", async () => {
    const store = create();
    for (const mode of ["readOnly", "disabled", "forbidden"] as const) {
      await expect(store.adapter(mode).upload!(input(A))).rejects.toThrow();
    }
    expect(await store.adapter("ready").load("forged-project")).toEqual({ kind: "forbidden" });
  });
});
