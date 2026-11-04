import { GF_LOCATION_ID } from "./payment-mirror-core";

export type ConnectionCheckReason =
  | "token_ausente"
  | "calendario_ausente"
  | "consulta_calendario_falhou"
  | "calendario_divergente"
  | "resposta_invalida"
  | "nao_autorizado"
  | "sem_permissao"
  | "limite_temporario"
  | "http_falhou"
  | "timeout"
  | "rede_indisponivel"
  | "verificacao_calendario_pendente";

export interface PaymentMirrorConnectionCheck {
  state: "ok" | "erro" | "nao_testado";
  status: number | null;
  reason: ConnectionCheckReason | null;
}

export interface PaymentMirrorConnectionResult {
  tokenConfigured: boolean;
  checkedAt: string;
  calendar: PaymentMirrorConnectionCheck;
  invoices: PaymentMirrorConnectionCheck;
  transactions: PaymentMirrorConnectionCheck;
  readAccessVerified: boolean;
  writeAccessVerified: false;
  pitIdentityVerified: false;
  syncActivated: false; // This diagnostic never activates sync; it does not read the current gates.
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
const BASE = "https://services.leadconnectorhq.com";
const TIMEOUT_MS = 8_000;
const notTested = (reason: ConnectionCheckReason): PaymentMirrorConnectionCheck => ({
  state: "nao_testado",
  status: null,
  reason,
});

export function incompletePaymentMirrorConnection(
  tokenConfigured: boolean,
  reason: "token_ausente" | "calendario_ausente" | "consulta_calendario_falhou",
  checkedAt = new Date().toISOString(),
): PaymentMirrorConnectionResult {
  return {
    tokenConfigured,
    checkedAt,
    calendar: notTested(reason),
    invoices: notTested("verificacao_calendario_pendente"),
    transactions: notTested("verificacao_calendario_pendente"),
    readAccessVerified: false,
    writeAccessVerified: false,
    pitIdentityVerified: false,
    syncActivated: false,
  };
}

function object(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function financeEnvelopeValid(
  raw: unknown,
  rowKey: "invoices" | "data",
  totalKey: "total" | "totalCount",
): boolean {
  const envelope = object(raw);
  const rows = envelope?.[rowKey];
  const total = envelope?.[totalKey];
  return (
    Array.isArray(rows) &&
    rows.length <= 1 &&
    typeof total === "number" &&
    Number.isSafeInteger(total) &&
    total >= rows.length &&
    rows.every((row) => object(row)?.altId === GF_LOCATION_ID)
  );
}

function httpReason(status: number): ConnectionCheckReason {
  if (status === 401) return "nao_autorizado";
  if (status === 403) return "sem_permissao";
  if (status === 429) return "limite_temporario";
  return "http_falhou";
}

/** Bounded GETs only. Raw response bodies and caught errors never leave this module. */
export async function probePaymentMirrorConnection(opts: {
  token: string | undefined;
  calendarId: string | null;
  fetch?: FetchLike;
}): Promise<PaymentMirrorConnectionResult> {
  const tokenConfigured = Boolean(opts.token?.trim());
  if (!tokenConfigured) return incompletePaymentMirrorConnection(false, "token_ausente");
  if (
    typeof opts.calendarId !== "string" ||
    !opts.calendarId ||
    opts.calendarId.length > 200 ||
    /\s/.test(opts.calendarId)
  )
    return incompletePaymentMirrorConnection(true, "calendario_ausente");

  const result = incompletePaymentMirrorConnection(true, "calendario_ausente");
  const fetcher: FetchLike = opts.fetch ?? ((url, init) => fetch(url, init));

  async function read(
    path: string,
    validate: (raw: unknown) => ConnectionCheckReason | null,
  ): Promise<PaymentMirrorConnectionCheck> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    let status: number | null = null;
    try {
      const work = (async (): Promise<PaymentMirrorConnectionCheck> => {
        const response = await fetcher(`${BASE}${path}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${opts.token}`,
            Version: "v3",
            Accept: "application/json",
          },
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
        status = response.status;
        if (!response.ok) return { state: "erro", status, reason: httpReason(status) };
        let raw: unknown;
        try {
          raw = await response.json();
        } catch {
          return { state: "erro", status, reason: "resposta_invalida" };
        }
        const reason = validate(raw);
        return { state: reason ? "erro" : "ok", status, reason };
      })();
      const timeout = new Promise<PaymentMirrorConnectionCheck>((resolve) => {
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
          resolve({ state: "erro", status, reason: "timeout" });
        }, TIMEOUT_MS);
      });
      return await Promise.race([work, timeout]);
    } catch {
      return { state: "erro", status, reason: timedOut ? "timeout" : "rede_indisponivel" };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const calendarId = opts.calendarId;
  result.calendar = await read(`/calendars/${encodeURIComponent(calendarId)}`, (raw) => {
    const calendar = object(object(raw)?.calendar);
    if (!calendar || typeof calendar.id !== "string" || typeof calendar.locationId !== "string")
      return "resposta_invalida";
    return calendar.id === calendarId && calendar.locationId === GF_LOCATION_ID
      ? null
      : "calendario_divergente";
  });
  if (result.calendar.state !== "ok") return result;

  const location = new URLSearchParams({
    altId: GF_LOCATION_ID,
    altType: "location",
    limit: "1",
    offset: "0",
  });
  const invoices = new URLSearchParams(location);
  invoices.set("paymentMode", "test");
  [result.invoices, result.transactions] = await Promise.all([
    read(`/invoices/?${invoices}`, (raw) =>
      financeEnvelopeValid(raw, "invoices", "total") ? null : "resposta_invalida",
    ),
    read(`/payments/transactions?${location}`, (raw) =>
      financeEnvelopeValid(raw, "data", "totalCount") ? null : "resposta_invalida",
    ),
  ]);
  result.readAccessVerified = result.invoices.state === "ok" && result.transactions.state === "ok";
  return result;
}
