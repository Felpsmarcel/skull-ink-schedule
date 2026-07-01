import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ghlFetch, type GhlFetchResult } from "@/lib/ghl";
import { useServerFn } from "@tanstack/react-start";
import {
  testGhlCompensation,
  type CompensationTestResult,
} from "@/lib/ghl-compensation-test.functions";

const CALENDAR_ID = "NzAYeRNJnvfpu7ynyoEK";

export const Route = createFileRoute("/_authenticated/_admin/ghl-test")({
  head: () => ({
    meta: [
      { title: "GHL Test — GF Tattoo Studio" },
      { name: "description", content: "Diagnóstico da integração GHL." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: GhlTest,
});

function GhlTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GhlFetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compLoading, setCompLoading] = useState(false);
  const [compResult, setCompResult] = useState<CompensationTestResult | null>(null);
  const runCompensation = useServerFn(testGhlCompensation);

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
        },
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function runCompensationTest() {
    setCompLoading(true);
    setCompResult(null);
    setError(null);
    try {
      // Free-slot rápido nos próximos 2 dias, 15 min, contato de teste.
      const start = new Date(Date.now() + 2 * 86_400_000);
      start.setHours(23, 30, 0, 0);
      const end = new Date(start.getTime() + 15 * 60_000);
      const contactId = window.prompt(
        "GHL contactId para teste de compensação (será criado e deletado um evento):",
      );
      if (!contactId) {
        setCompLoading(false);
        return;
      }
      const res = await runCompensation({
        data: {
          calendarId: CALENDAR_ID,
          contactId,
          startISO: start.toISOString(),
          endISO: end.toISOString(),
        },
      });
      setCompResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCompLoading(false);
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

      <div className="mt-2 border-t border-border pt-4">
        <h2 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
          Smoke test — compensação GHL
        </h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Cria um evento no GHL e imediatamente o deleta. Verifica que o
          caminho DELETE usado pela compensação (`createAppointmentRecord`)
          está saudável. Em caso de falha, grava em `ghl_sync_failures`.
        </p>
        <button
          type="button"
          onClick={runCompensationTest}
          disabled={compLoading}
          className="rounded-md border border-foreground/20 bg-card px-4 py-2 text-xs font-semibold uppercase tracking-widest text-foreground disabled:opacity-60"
        >
          {compLoading ? "Executando..." : "Testar compensação (create + delete)"}
        </button>
        {compResult && (
          <pre className="mt-3 overflow-auto rounded-md border border-border bg-card p-3 text-[11px] leading-relaxed text-foreground">
{JSON.stringify(compResult, null, 2)}
          </pre>
        )}
      </div>

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