import { test, expect } from "@playwright/test";
import { admin, cleanup, uniqueName } from "./fixtures/db";

const db = admin();

test.afterAll(async () => {
  await cleanup(db);
});

test("novo cliente com consentimento gera codigo, QR e pagina publica sem PII", async ({ page }) => {
  const nome = uniqueName("Novo");
  const telefone = "+32471009911";

  await page.goto("/totem");
  await page.getByRole("button", { name: /sou um novo cliente/i }).click();

  await page.getByPlaceholder("Como devemos chamá-lo?").fill(nome);
  await page.getByPlaceholder("+32 ...").fill(telefone);
  await page.getByRole("button", { name: /continuar/i }).click();

  await expect(page.getByRole("heading", { name: /confirmar chegada/i })).toBeVisible();
  await expect(page.getByText(/primeira visita/i)).toBeVisible();

  // Consentimento marcado
  const consent = page.getByRole("checkbox");
  await consent.check();
  await expect(consent).toBeChecked();

  await page.getByRole("button", { name: /confirmar minha chegada/i }).click();

  await page.waitForURL(/\/totem\/pronto\?token=/);
  const token = new URL(page.url()).searchParams.get("token");
  expect(token).toBeTruthy();

  const codigo = (await page.getByTestId("checkin-codigo").innerText()).trim();
  expect(codigo).toMatch(/^GF-\d+/);
  await expect(page.getByTestId("checkin-qr")).toBeVisible();

  // Estado no banco: consentimento gravado
  const { data: row } = await db
    .from("checkins")
    .select("consentimento_comunicacao, status, codigo_atendimento")
    .eq("qr_token", token!)
    .single();
  expect(row?.consentimento_comunicacao).toBe(true);
  expect(row?.status).toBe("aguardando");
  expect(row?.codigo_atendimento).toBe(codigo);

  // Pagina publica do cliente
  await page.goto(`/a/${token}`);
  await expect(page.getByTestId("publico-codigo")).toHaveText(codigo);
  await expect(page.getByTestId("publico-status")).toHaveText(/aguardando atendimento/i);

  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain(nome.toLowerCase());
  expect(body).not.toContain("9911");
});

test("confirmar sem consentimento tambem registra a chegada", async ({ page }) => {
  const nome = uniqueName("SemConsent");

  await page.goto("/totem");
  await page.getByRole("button", { name: /sou um novo cliente/i }).click();
  await page.getByPlaceholder("Como devemos chamá-lo?").fill(nome);
  await page.getByRole("button", { name: /continuar/i }).click();
  await page.getByRole("button", { name: /confirmar minha chegada/i }).click();

  await page.waitForURL(/\/totem\/pronto\?token=/);
  const token = new URL(page.url()).searchParams.get("token")!;

  const { data: row } = await db
    .from("checkins")
    .select("consentimento_comunicacao, status")
    .eq("qr_token", token)
    .single();
  expect(row?.consentimento_comunicacao).toBe(false);
  expect(row?.status).toBe("aguardando");
});
