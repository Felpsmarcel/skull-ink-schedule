import { test, expect } from "@playwright/test";
import { admin, cleanup, uniqueName } from "./fixtures/db";
import { restoreStaffSession } from "./fixtures/auth";

const db = admin();

test.afterAll(async () => {
  await cleanup(db);
});

test("check-in aparece na Home da equipa e muda de estado com Iniciar/Concluir", async ({
  page,
  baseURL,
}) => {
  const nome = uniqueName("Fila");

  // 1) Check-in no totem
  await page.goto("/totem");
  await page.getByRole("button", { name: /sou um novo cliente/i }).click();
  await page.getByPlaceholder("Como devemos chamá-lo?").fill(nome);
  await page.getByRole("button", { name: /continuar/i }).click();
  await page.getByRole("button", { name: /confirmar minha chegada/i }).click();
  await page.waitForURL(/\/totem\/pronto\?token=/);
  const token = new URL(page.url()).searchParams.get("token")!;
  const codigo = (await page.getByTestId("checkin-codigo").innerText()).trim();

  // 2) Home da equipa (precisa de sessao)
  const hasSession = await restoreStaffSession(page, baseURL ?? "http://localhost:8080");
  test.skip(!hasSession, "sem sessao da equipa injectada no ambiente de testes");

  await page.goto("/home");
  const item = page.getByTestId("fila-item").filter({ hasText: codigo });
  await expect(item).toBeVisible();
  await expect(item.getByTestId("fila-nome")).toHaveText(nome);
  await expect(page.getByText("Aguardando").first()).toBeVisible();

  // 3) Iniciar -> em atendimento
  await item.getByRole("button", { name: /iniciar/i }).click();
  await expect(item.getByRole("button", { name: /concluir/i })).toBeVisible();

  await page.goto(`/a/${token}`);
  await expect(page.getByTestId("publico-status")).toHaveText(/em atendimento/i);

  // 4) Concluir -> sai da fila ativa
  await page.goto("/home");
  const ativo = page.getByTestId("fila-item").filter({ hasText: codigo });
  await ativo.getByRole("button", { name: /concluir/i }).click();
  await expect(page.getByTestId("fila-item").filter({ hasText: codigo })).toHaveCount(0);

  await page.goto(`/a/${token}`);
  await expect(page.getByTestId("publico-status")).toHaveText(/concluído/i);
});
