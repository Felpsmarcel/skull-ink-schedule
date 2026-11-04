import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GF_LOCATION_ID } from "@/lib/payment-mirror-core";
import { probePaymentMirrorConnection } from "@/lib/payment-mirror-connection.server";

const fake = vi.hoisted(() => ({
  role: "admin" as string | null,
  missingProfile: false,
  profileError: false,
  queryThrows: false,
  artistError: false,
  token: "synthetic-token-do-not-expose" as string | undefined,
  calendarId: "synthetic-calendar" as string | null,
  events: [] as string[],
  network: vi.fn(),
  from: vi.fn(),
  authMiddleware: {},
}));

// Execute the real server handler; only replace framework dispatch and authenticated DB transport.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: (options: { method: string }) => {
    expect(options.method).toBe("POST");
    let middleware: unknown[] = [];
    const builder = {
      middleware: (items: unknown[]) => {
        middleware = items;
        return builder;
      },
      handler: (handler: (args: unknown) => unknown) => ({
        run: (context: unknown, data?: unknown) => {
          expect(middleware).toEqual([fake.authMiddleware]);
          return handler({ context, data });
        },
      }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: fake.authMiddleware,
}));

import { checkPaymentMirrorConnection } from "@/lib/payment-mirror-connection.functions";

const SECRET = "synthetic-token-do-not-expose";
const CALENDAR = "synthetic-calendar";
const PRIVATE_NAME = "Synthetic private customer";
const originalProcess = process;
const runHandler = (data?: unknown) =>
  (
    checkPaymentMirrorConnection as unknown as {
      run: (context: unknown, data?: unknown) => Promise<unknown>;
    }
  ).run({ userId: "signed-admin-id", supabase: { from: fake.from } }, data);

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fixtureFetch() {
  return vi.fn(async (url: string, _init: RequestInit) => {
    const path = new URL(url).pathname;
    if (path === `/calendars/${CALENDAR}`)
      return response({ calendar: { id: CALENDAR, locationId: GF_LOCATION_ID } });
    if (path === "/invoices/")
      return response({
        invoices: [{ altId: GF_LOCATION_ID, contactDetails: { name: PRIVATE_NAME } }],
        total: 91,
      });
    if (path === "/payments/transactions")
      return response({
        data: [{ altId: GF_LOCATION_ID, contactName: PRIVATE_NAME }],
        totalCount: 26,
      });
    throw new Error(`Unexpected synthetic route ${url}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.role = "admin";
  fake.missingProfile = false;
  fake.profileError = false;
  fake.queryThrows = false;
  fake.artistError = false;
  fake.token = SECRET;
  fake.calendarId = CALENDAR;
  fake.events = [];
  fake.network.mockImplementation(fixtureFetch());
  vi.stubGlobal("fetch", fake.network);
  const environment = new Proxy(originalProcess.env, {
    get(target, property) {
      if (property === "GHL_TOKEN") {
        fake.events.push("env:GHL_TOKEN");
        return fake.token;
      }
      return Reflect.get(target, property);
    },
  });
  vi.stubGlobal(
    "process",
    new Proxy(originalProcess, {
      get(target, property) {
        return property === "env" ? environment : Reflect.get(target, property);
      },
    }),
  );
  fake.from.mockImplementation((table: string) => {
    fake.events.push(`db:${table}`);
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((key: string, value: unknown) => {
        expect([key, value]).toEqual(
          table === "app_users" ? ["id", "signed-admin-id"] : ["active", true],
        );
        return query;
      }),
      not: vi.fn().mockImplementation((...args: unknown[]) => {
        expect(args).toEqual(["ghl_calendar_id", "is", null]);
        return query;
      }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation((limit: number) => {
        expect(limit).toBe(1);
        return query;
      }),
      maybeSingle: async () => {
        if (fake.queryThrows) throw new Error(SECRET);
        if (table === "app_users")
          return {
            data: fake.missingProfile ? null : { role: fake.role },
            error: fake.profileError ? { message: SECRET } : null,
          };
        expect(table).toBe("artists");
        return {
          data: fake.calendarId ? { ghl_calendar_id: fake.calendarId } : null,
          error: fake.artistError ? { message: SECRET } : null,
        };
      },
    };
    return query;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("read-only payment connection probe", () => {
  it("performs exactly three bounded GETs, then returns only non-sensitive evidence", async () => {
    const fetcher = fixtureFetch();
    const result = await probePaymentMirrorConnection({
      token: SECRET,
      calendarId: CALENDAR,
      fetch: fetcher,
    });
    expect(result).toMatchObject({
      tokenConfigured: true,
      calendar: { state: "ok", status: 200, reason: null },
      invoices: { state: "ok", status: 200, reason: null },
      transactions: { state: "ok", status: 200, reason: null },
      readAccessVerified: true,
      writeAccessVerified: false,
      pitIdentityVerified: false,
      syncActivated: false,
    });
    expect(Number.isNaN(Date.parse(result.checkedAt))).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(new URL(fetcher.mock.calls[0][0]).pathname).toBe(`/calendars/${CALENDAR}`);
    for (const [url, init] of fetcher.mock.calls) {
      expect(new URL(url).origin).toBe("https://services.leadconnectorhq.com");
      expect(init).toMatchObject({
        method: "GET",
        cache: "no-store",
        redirect: "error",
        headers: { Authorization: `Bearer ${SECRET}`, Version: "v3", Accept: "application/json" },
      });
      expect(init.body).toBeUndefined();
      if (!new URL(url).pathname.startsWith("/calendars/")) {
        expect(new URL(url).searchParams.get("altId")).toBe(GF_LOCATION_ID);
        expect(new URL(url).searchParams.get("altType")).toBe("location");
        expect(new URL(url).searchParams.get("limit")).toBe("1");
        expect(new URL(url).searchParams.get("offset")).toBe("0");
      }
      if (new URL(url).pathname === "/invoices/")
        expect(new URL(url).searchParams.get("paymentMode")).toBe("test");
    }
    const output = JSON.stringify(result);
    for (const value of [SECRET, CALENDAR, PRIVATE_NAME, GF_LOCATION_ID])
      expect(output).not.toContain(value);
    expect(Object.keys(result).sort()).toEqual([
      "calendar",
      "checkedAt",
      "invoices",
      "pitIdentityVerified",
      "readAccessVerified",
      "syncActivated",
      "tokenConfigured",
      "transactions",
      "writeAccessVerified",
    ]);
  });

  it("accepts well-formed empty lists without making aggregate or write claims", async () => {
    const fetcher = fixtureFetch();
    fetcher.mockImplementation(async (url) =>
      new URL(url).pathname.startsWith("/calendars/")
        ? response({ calendar: { id: CALENDAR, locationId: GF_LOCATION_ID } })
        : response(
            new URL(url).pathname === "/invoices/"
              ? { invoices: [], total: 0 }
              : { data: [], totalCount: 0 },
          ),
    );
    const result = await probePaymentMirrorConnection({
      token: SECRET,
      calendarId: CALENDAR,
      fetch: fetcher,
    });
    expect(result.readAccessVerified).toBe(true);
    expect(result.writeAccessVerified).toBe(false);
  });

  it.each([null, "", "with whitespace"])(
    "missing or invalid calendar %s makes zero HTTP calls",
    async (calendarId) => {
      const fetcher = fixtureFetch();
      const result = await probePaymentMirrorConnection({
        token: SECRET,
        calendarId,
        fetch: fetcher,
      });
      expect(result.calendar.reason).toBe("calendario_ausente");
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("missing token makes zero HTTP calls", async () => {
    const fetcher = fixtureFetch();
    const result = await probePaymentMirrorConnection({
      token: undefined,
      calendarId: CALENDAR,
      fetch: fetcher,
    });
    expect(result.tokenConfigured).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    { calendar: { id: CALENDAR, locationId: "foreign-studio" } },
    { calendar: { id: "different-calendar", locationId: GF_LOCATION_ID } },
  ])("calendar mismatch stops before financial reads", async (body) => {
    const fetcher = vi.fn(async () => response(body));
    const result = await probePaymentMirrorConnection({
      token: SECRET,
      calendarId: CALENDAR,
      fetch: fetcher,
    });
    expect(result.calendar.reason).toBe("calendario_divergente");
    expect(result.invoices.state).toBe("nao_testado");
    expect(result.readAccessVerified).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([{}, { calendar: null }, { calendar: { id: CALENDAR } }])(
    "rejects malformed calendar envelopes",
    async (body) => {
      const fetcher = vi.fn(async () => response(body));
      const result = await probePaymentMirrorConnection({
        token: SECRET,
        calendarId: CALENDAR,
        fetch: fetcher,
      });
      expect(result.calendar.reason).toBe("resposta_invalida");
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it.each([
    [401, "nao_autorizado"],
    [403, "sem_permissao"],
    [429, "limite_temporario"],
    [500, "http_falhou"],
  ])(
    "returns allowlisted reason for HTTP %s with no retries or raw error",
    async (status, reason) => {
      const fetcher = vi.fn(async () =>
        response({ message: `${SECRET} ${PRIVATE_NAME}` }, status as number),
      );
      const result = await probePaymentMirrorConnection({
        token: SECRET,
        calendarId: CALENDAR,
        fetch: fetcher,
      });
      expect(result.calendar).toEqual({ state: "erro", status, reason });
      expect(fetcher).toHaveBeenCalledOnce();
      expect(JSON.stringify(result)).not.toContain(SECRET);
      expect(JSON.stringify(result)).not.toContain(PRIVATE_NAME);
    },
  );

  it("reports independent financial 401 and 403 without claiming read access", async () => {
    const fetcher = fixtureFetch();
    fetcher.mockImplementation(async (url) =>
      new URL(url).pathname.startsWith("/calendars/")
        ? response({ calendar: { id: CALENDAR, locationId: GF_LOCATION_ID } })
        : response({ message: SECRET }, new URL(url).pathname === "/invoices/" ? 401 : 403),
    );
    const result = await probePaymentMirrorConnection({
      token: SECRET,
      calendarId: CALENDAR,
      fetch: fetcher,
    });
    expect(result.invoices.reason).toBe("nao_autorizado");
    expect(result.transactions.reason).toBe("sem_permissao");
    expect(result.readAccessVerified).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it.each([
    { invoices: [], total: "0" },
    { invoices: [{ altId: "foreign" }], total: 1 },
    { invoices: [{ altId: GF_LOCATION_ID }], total: 0 },
    { invoices: [], total: -1 },
    { invoices: [{ altId: GF_LOCATION_ID }, { altId: GF_LOCATION_ID }], total: 2 },
  ])("malformed or foreign financial envelope fails closed", async (body) => {
    const fetcher = fixtureFetch();
    const initial = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (url, init) =>
      new URL(url).pathname === "/invoices/" ? response(body) : initial(url, init),
    );
    const result = await probePaymentMirrorConnection({
      token: SECRET,
      calendarId: CALENDAR,
      fetch: fetcher,
    });
    expect(result.invoices).toMatchObject({
      state: "erro",
      status: 200,
      reason: "resposta_invalida",
    });
    expect(result.readAccessVerified).toBe(false);
  });

  it("does not expose thrown network errors or invalid JSON bodies", async () => {
    const network = vi.fn(async () => {
      throw new Error(SECRET);
    });
    const result = await probePaymentMirrorConnection({
      token: SECRET,
      calendarId: CALENDAR,
      fetch: network,
    });
    expect(result.calendar.reason).toBe("rede_indisponivel");
    expect(JSON.stringify(result)).not.toContain(SECRET);
    const invalidJson = vi.fn(async () => new Response(SECRET));
    const invalid = await probePaymentMirrorConnection({
      token: SECRET,
      calendarId: CALENDAR,
      fetch: invalidJson,
    });
    expect(invalid.calendar.reason).toBe("resposta_invalida");
    expect(JSON.stringify(invalid)).not.toContain(SECRET);
  });

  it("aborts an unresponsive request after 8 seconds without retrying", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetcher = vi.fn((_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return new Promise<Response>(() => {});
    });
    const pending = probePaymentMirrorConnection({
      token: SECRET,
      calendarId: CALENDAR,
      fetch: fetcher,
    });
    await vi.advanceTimersByTimeAsync(8_000);
    const result = await pending;
    expect(result.calendar.reason).toBe("timeout");
    expect(signal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

describe("connection server function authorization", () => {
  it.each(["artist", "seller", "unknown", "ADMIN", "", null])(
    "denies %s before env, artist query or HTTP",
    async (role) => {
      fake.role = role;
      await expect(runHandler()).rejects.toThrow("Forbidden");
      expect(fake.events).toEqual(["db:app_users"]);
      expect(fake.network).not.toHaveBeenCalled();
    },
  );

  it.each(["missing", "error"])(
    "profile %s fails closed without sensitive errors",
    async (kind) => {
      fake.missingProfile = kind === "missing";
      fake.profileError = kind === "error";
      await expect(runHandler()).rejects.toThrow("Forbidden");
      expect(fake.events).toEqual(["db:app_users"]);
      expect(fake.network).not.toHaveBeenCalled();
    },
  );

  it("admin uses only the authenticated client mapping and ignores forged client inputs", async () => {
    const result = await runHandler({
      calendarId: "forged",
      locationId: "foreign",
      token: "forged",
    });
    expect(fake.events).toEqual(["db:app_users", "env:GHL_TOKEN", "db:artists"]);
    expect(result).toMatchObject({
      readAccessVerified: true,
      writeAccessVerified: false,
      syncActivated: false,
    });
    expect(fake.network).toHaveBeenCalledTimes(3);
    expect(fake.network.mock.calls[0][0]).toContain(`/calendars/${CALENDAR}`);
    expect(JSON.stringify(result)).not.toContain("forged");
  });

  it("calendar mapping read error returns incomplete without querying GHL or leaking DB errors", async () => {
    fake.artistError = true;
    const result = await runHandler();
    expect(result).toMatchObject({
      tokenConfigured: true,
      calendar: { reason: "consulta_calendario_falhou" },
      readAccessVerified: false,
    });
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(fake.network).not.toHaveBeenCalled();
  });

  it("no active calendar returns incomplete without HTTP", async () => {
    fake.calendarId = null;
    expect(await runHandler()).toMatchObject({
      calendar: { reason: "calendario_ausente" },
      readAccessVerified: false,
    });
    expect(fake.network).not.toHaveBeenCalled();
  });

  it("thrown profile transport errors become Forbidden before secret access", async () => {
    fake.queryThrows = true;
    await expect(runHandler()).rejects.toThrow("Forbidden");
    expect(fake.events).toEqual(["db:app_users"]);
    expect(fake.network).not.toHaveBeenCalled();
  });

  it("missing runtime token skips calendar lookup and network", async () => {
    fake.token = undefined;
    const result = await runHandler();
    expect(result).toMatchObject({ tokenConfigured: false, calendar: { reason: "token_ausente" } });
    expect(fake.events).toEqual(["db:app_users", "env:GHL_TOKEN"]);
    expect(fake.network).not.toHaveBeenCalled();
  });
});
