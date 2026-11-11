import { describe, it, expect, vi } from "vitest";
import { readMyDayPages, requireMyDayAdmin } from "../../src/lib/my-day-read";
describe("My Day server read boundaries", () => {
  it("admin authorization precedes any data read", () => {
    const read = vi.fn();
    for (const role of [null, "artist", "seller", "unknown"]) {
      try {
        requireMyDayAdmin(role);
        read();
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(403);
      }
    }
    expect(read).not.toHaveBeenCalled();
    requireMyDayAdmin("admin");
  });
  it("paginates until the first short page", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ data: [1, 2], error: null })
      .mockResolvedValueOnce({ data: [3], error: null });
    expect(await readMyDayPages(read, 2)).toEqual([1, 2, 3]);
    expect(read.mock.calls).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });
  it("rejects partial data when a later page fails", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ data: [1, 2], error: null })
      .mockResolvedValueOnce({ data: null, error: "failed" });
    await expect(readMyDayPages(read, 2)).rejects.toThrow();
  });
  it("safety cap never reports complete aggregates", async () => {
    await expect(readMyDayPages(async () => ({ data: [1, 2], error: null }), 2, 1)).rejects.toThrow(
      "Cobertura incompleta",
    );
  });
});
