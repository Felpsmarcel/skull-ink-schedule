import { describe, expect, it, vi } from "vitest";
import { createPhotoRequestGate } from "@/lib/photo-request-gate";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("photo request generations", () => {
  it("ignores an old upload confirmation after the same project changes adapter", async () => {
    const gate = createPhotoRequestGate();
    const save = vi.fn();
    const oldUpload = deferred<string>();
    gate.begin();
    const originalGeneration = gate.capture()!;
    const pending = oldUpload.promise.then((id) => {
      if (originalGeneration()) save(id);
    });

    const next = gate.begin();
    oldUpload.resolve("photo-from-previous-adapter");
    await pending;
    expect(save).not.toHaveBeenCalled();
    expect(next.isCurrent()).toBe(true);
  });

  it("ignores an old read/removal after leaving and returning to the same project", () => {
    const gate = createPhotoRequestGate();
    const originalA = gate.begin();
    const removeFromA = gate.capture()!;
    originalA.end();
    const b = gate.begin();
    b.end();
    const returnedA = gate.begin();
    expect(removeFromA()).toBe(false);
    expect(originalA.isCurrent()).toBe(false);
    expect(returnedA.isCurrent()).toBe(true);
    // Late cleanup from the former component cannot invalidate the new generation.
    originalA.end();
    expect(returnedA.isCurrent()).toBe(true);
  });

  it("accepts callbacks only while the view remains mounted in its current generation", () => {
    const gate = createPhotoRequestGate();
    expect(gate.capture()).toBeNull();
    const active = gate.begin();
    const completion = gate.capture()!;
    expect(completion()).toBe(true);
    active.end();
    expect(completion()).toBe(false);
    expect(gate.capture()).toBeNull();
  });
});
