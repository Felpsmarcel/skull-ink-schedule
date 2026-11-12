import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { isOpsLightPath, OPS_LIGHT_BOOT_SCRIPT } from "@/lib/ops-light-theme";

// Inspect actual UI registrations so a forgotten screen fails here instead of
// silently returning to the old identity when reached from Conta e gestão.
function uiPaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return uiPaths(path);
    if (!entry.name.endsWith(".tsx") || entry.name.startsWith("[")) return [];
    const source = readFileSync(path, "utf8");
    if (!/component:/.test(source)) return [];
    const id = source.match(/createFileRoute\(\s*["']([^"']+)["']\)/)?.[1];
    if (!id) return [];
    return [
      "/" +
        id
          .split("/")
          .filter((part) => part && !part.startsWith("_"))
          .map((part) => (part.startsWith("$") ? "example" : part.replace(/_$/, "")))
          .join("/"),
    ];
  });
}
const applicationPaths = uiPaths(fileURLToPath(new URL("../../src/routes", import.meta.url)));
const outsidePaths = [
  "/menu-extra",
  "/appointments/newer",
  "/totem-extra",
  "/admin/other-tool",
  "/agendamentos",
  "/financeiro-extra",
  "/authx",
  "/.lovable/oauth/consent",
  "/api/public/mobile-dashboard",
  "/mcp",
  "/lovable/email/auth/preview",
];

describe("application theme coverage", () => {
  it("covers every registered application screen, including administrative destinations", () => {
    expect(applicationPaths.length).toBeGreaterThan(40);
    for (const pathname of applicationPaths) {
      expect(isOpsLightPath(pathname), pathname).toBe(true);
      expect(isOpsLightPath(`${pathname.replace(/\/$/, "")}/`), pathname).toBe(true);
    }
  });

  it("does not match unrelated prefixes, API endpoints or external consent screens", () => {
    for (const pathname of outsidePaths) expect(isOpsLightPath(pathname), pathname).toBe(false);
  });
});

describe("pre-paint theme parity", () => {
  it("keeps direct loads consistent with route navigation across the entire UI", () => {
    for (const pathname of [...applicationPaths, ...outsidePaths]) {
      const classes: string[] = [];
      runInNewContext(OPS_LIGHT_BOOT_SCRIPT, {
        location: { pathname },
        document: { documentElement: { classList: { add: (name: string) => classes.push(name) } } },
      });
      expect(classes.includes("gf-ops-light"), pathname).toBe(isOpsLightPath(pathname));
    }
  });
});
