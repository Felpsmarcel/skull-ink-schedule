import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ghlFetch, type GhlFetchResult } from "@/lib/ghl";

const CALENDAR_ID = "NzAYeRNJnvfpu7ynyoEK";
const LOCATION_ID = "9iqrKUVPDddINb9S4Iwd";

export const Route = createFileRoute("/ghl-test")({
  head: () => ({ meta: [{ title: "GHL Test — GF Tattoo Studio" }] }),
  component: GhlTest,
});

function GhlTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GhlFetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setDate(end.getDate() + 7);
      end.setHours(23, 59, 59, 999);

      const res = await ghlFetch({
        path: `/calendars/${CALENDAR_ID}/free-slots`,
        method: "GET",
        version: "2021-04-15",
        query: {
          startDate: start.getTime(),
          endDate: end.getTime(),
          timezone: "Europe/Brussels",
          locationId: LOCATION_ID,
        },
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col gap-4 px-5 py-8">
      <Link to="/" className="text-xs uppercase tracking-widest text-muted-foreground">
        ← Voltar
      </Link>
      <h1
        className="text-3xl tracking-[0.14em] text-foreground"
        style={{ fontFamily: "var(--font-display)" }}
      >
        GHL — TESTE
      </h1>
      <p className="text-sm text-muted-foreground">
        Free-slots do calendário Randevu — hoje até +7 dias, Europe/Brussels.
      </p>

      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-60"
      >
        {loading ? "Carregando..." : "Buscar free-slots"}
      </button>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-2">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            HTTP {result.status} {result.ok ? "OK" : "FAIL"}
          </div>
          {result.url && (
            <div className="break-all text-[10px] text-muted-foreground">{result.url}</div>
          )}
          <pre className="max-h-[60vh] overflow-auto rounded-md border border-border bg-card p-3 text-[11px] leading-relaxed text-foreground">
{JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}