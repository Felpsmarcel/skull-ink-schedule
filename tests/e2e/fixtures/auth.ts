import type { Page } from "@playwright/test";

/**
 * Restaura a sessão da equipa (injectada no ambiente de testes) para poder abrir /home.
 * Devolve false quando não há sessão disponível — o teste é então ignorado.
 */
export async function restoreStaffSession(page: Page, baseURL: string): Promise<boolean> {
  const storageKey = process.env["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"];
  const sessionJson = process.env["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"];
  const cookiesJson = process.env["LOVABLE_BROWSER_SUPABASE_COOKIES_JSON"];
  if (!storageKey || !sessionJson) return false;

  if (cookiesJson) {
    const cookies = (JSON.parse(cookiesJson) as Array<Record<string, unknown>>).map((c) => ({
      ...c,
      url: baseURL,
    }));
    await page.context().addCookies(cookies as never);
  }

  await page.goto(baseURL);
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [storageKey, sessionJson],
  );
  return true;
}
