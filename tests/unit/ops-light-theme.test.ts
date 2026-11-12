import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { isOpsLightPath, OPS_LIGHT_BOOT_SCRIPT } from "@/lib/ops-light-theme";

describe("isOpsLightPath", () => {
  it("activates on the Agenda and the login flow", () => {
    expect(isOpsLightPath("/agenda")).toBe(true);
    expect(isOpsLightPath("/menu")).toBe(true);
    expect(isOpsLightPath("/auth")).toBe(true);
    expect(isOpsLightPath("/auth/recover")).toBe(true);
    expect(isOpsLightPath("/projetos")).toBe(true);
    expect(isOpsLightPath("/projetos/abc")).toBe(true);
    expect(isOpsLightPath("/preview/ficha-projeto")).toBe(true);
    expect(isOpsLightPath("/financeiro")).toBe(true);
    expect(isOpsLightPath("/painel-tatuador")).toBe(true);
    expect(isOpsLightPath("/appointments/new")).toBe(true);
    expect(isOpsLightPath("/appointments/new/agenda")).toBe(true);
    expect(isOpsLightPath("/totem")).toBe(true);
    expect(isOpsLightPath("/totem/confirmar")).toBe(true);
    expect(isOpsLightPath("/a/token")).toBe(true);
    expect(isOpsLightPath("/admin/fila")).toBe(true);
  });
  it("keeps every other screen on the current theme", () => {
    expect(isOpsLightPath("/home")).toBe(false);
    expect(isOpsLightPath("/menu-extra")).toBe(false);
    expect(isOpsLightPath("/appointments/newer")).toBe(false);
    expect(isOpsLightPath("/totem-extra")).toBe(false);
    expect(isOpsLightPath("/admin/equipe")).toBe(false);
    expect(isOpsLightPath("/agendamentos")).toBe(false);
    expect(isOpsLightPath("/financeiro-extra")).toBe(false);
    expect(isOpsLightPath("/authx")).toBe(false);
  });
});

describe("pre-paint theme parity", () => {
  it("keeps the initial paint consistent with runtime route changes", () => {
    for (const pathname of [
      "/menu",
      "/menu-extra",
      "/agenda",
      "/home",
      "/financeiro",
      "/admin/equipe",
      "/appointments/new/agenda",
      "/totem",
    ]) {
      const classes: string[] = [];
      runInNewContext(OPS_LIGHT_BOOT_SCRIPT, {
        location: { pathname },
        document: { documentElement: { classList: { add: (name: string) => classes.push(name) } } },
      });
      expect(classes.includes("gf-ops-light"), pathname).toBe(isOpsLightPath(pathname));
    }
  });
});
