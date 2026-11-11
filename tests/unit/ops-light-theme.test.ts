import { describe, expect, it } from "vitest";
import { isOpsLightPath } from "@/lib/ops-light-theme";

describe("isOpsLightPath", () => {
  it("activates on the Agenda and the login flow", () => {
    expect(isOpsLightPath("/agenda")).toBe(true);
    expect(isOpsLightPath("/auth")).toBe(true);
    expect(isOpsLightPath("/auth/recover")).toBe(true);
  });
  it("keeps every other screen on the current theme", () => {
    expect(isOpsLightPath("/home")).toBe(false);
    expect(isOpsLightPath("/appointments/new/agenda")).toBe(false);
    expect(isOpsLightPath("/agendamentos")).toBe(false);
    expect(isOpsLightPath("/financeiro")).toBe(false);
    expect(isOpsLightPath("/authx")).toBe(false);
  });
});
