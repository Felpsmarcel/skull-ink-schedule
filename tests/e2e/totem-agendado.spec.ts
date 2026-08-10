import { test, expect } from "@playwright/test";
import { admin, cleanup, seedClient, type SeededClient } from "./fixtures/db";

const db = admin();
let cliente: SeededClient;

test.beforeAll(async () => {
  cliente = await seedClient(db, { withAppointmentToday: true });
});

test.afterAll(async () => {
  await cleanup(db);
});

test("cliente com agendamento: busca mascarada, validacao por 4 digitos e check-in", async ({
  page,
}) => {
  await page.goto("/totem");
  await page.getByRole("button", { name: /tenho agendamento/i }).click();

  await page.getByPlaceholder(/Ex\.: Maria/).fill(cliente.nome.split(" ").slice(0, 2).join(" "));
  await page.getByRole("button", { name: /pesquisar/i }).click();

  // O resultado aparece mascarado (nome parcial + telefone oculto)
  const resultado = page.getByText(new RegExp(`•••• ${cliente.last4}`)).first();
  await expect(resultado).toBeVisible();
  const bodyBusca = await page.locator("body").innerText();
  expect(bodyBusca).not.toContain(cliente.telefone);

  await resultado.click();
  await expect(page.getByText(/4 últimos dígitos/i)).toBeVisible();

  // Digitos errados sao rejeitados
  const input = page.getByPlaceholder("0000");
  const errado = cliente.last4 === "0000" ? "1111" : "0000";
  await input.fill(errado);
  await page.getByRole("button", { name: /^confirmar$/i }).click();
  await expect(page.getByText(/não coincidem/i)).toBeVisible();

  // Digitos corretos liberam a confirmacao
  await input.fill(cliente.last4);
  await page.getByRole("button", { name: /^confirmar$/i }).click();

  await expect(page.getByRole("heading", { name: /confirmar chegada/i })).toBeVisible();
  await expect(page.getByText(/horário agendado/i)).toBeVisible();
  if (cliente.artistNome) {
    await expect(page.getByText(cliente.artistNome).first()).toBeVisible();
  }

  await page.getByRole("button", { name: /confirmar minha chegada/i }).click();
  await page.waitForURL(/\/totem\/pronto\?token=/);
  const token = new URL(page.url()).searchParams.get("token")!;

  await expect(page.getByTestId("checkin-codigo")).toHaveText(/^GF-\d+/);
  await expect(page.getByTestId("checkin-qr")).toBeVisible();

  const { data: row } = await db
    .from("checkins")
    .select("appointment_id, contact_id, artist_id, scheduled_at, status")
    .eq("qr_token", token)
    .single();
  expect(row?.contact_id).toBe(cliente.contactId);
  expect(row?.appointment_id).toBe(cliente.appointmentId);
  expect(row?.scheduled_at).toBeTruthy();
  expect(row?.status).toBe("aguardando");
});
