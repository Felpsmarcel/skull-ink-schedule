import { describe, expect, it } from "vitest";
import { isOpsLightPath } from "@/lib/ops-light-theme";

describe("isOpsLightPath", () => {
  it("activates on the Agenda and the login flow", () => {
    expect(isOpsLightPath("/agenda")).toBe(true);
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
    expect(isOpsLightPath("/appointments/newer")).toBe(false);
    expect(isOpsLightPath("/totem-extra")).toBe(false);
    expect(isOpsLightPath("/admin/equipe")).toBe(false);
    expect(isOpsLightPath("/agendamentos")).toBe(false);
    expect(isOpsLightPath("/financeiro-extra")).toBe(false);
    expect(isOpsLightPath("/authx")).toBe(false);
  });
});
