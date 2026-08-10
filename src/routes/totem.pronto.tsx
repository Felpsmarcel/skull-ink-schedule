import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { getCheckinByToken } from "@/lib/checkin.functions";
import { useTotemDraft } from "@/stores/totem-checkin";

export const Route = createFileRoute("/totem/pronto")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Chegada confirmada — GF Tattoo" },
      { name: "description", content: "A sua chegada foi registada. Leia o QR Code." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : "",
  }),
  component: TotemPronto,
});

function TotemPronto() {
  const { token } = Route.useSearch();
  const fetchCheckin = useServerFn(getCheckinByToken);
  const reset = useTotemDraft((s) => s.reset);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["checkin", token],
    queryFn: () => fetchCheckin({ data: { token } }),
    enabled: Boolean(token),
  });

  const qrUrl = token ? `${window.location.origin}/a/${token}` : "";

  useEffect(() => {
    if (!qrUrl) return;
    let cancelled = false;
    void (async () => {
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(qrUrl, {
        width: 420,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      if (!cancelled) setQrDataUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [qrUrl]);

  // Limpa os dados do cliente do ecrã do totem após 90 segundos.
  useEffect(() => {
    const timer = setTimeout(() => {
      reset();
      window.location.href = "/totem";
    }, 90_000);
    return () => clearTimeout(timer);
  }, [reset]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-6 py-10 text-center text-foreground">
      <CheckCircle2 className="h-14 w-14 text-primary" />
      <div className="space-y-1">
        <h1 className="font-display text-2xl uppercase tracking-[0.15em]">Chegada confirmada</h1>
        <p className="text-sm text-muted-foreground">A equipa já foi avisada.</p>
      </div>

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : data ? (
        <p data-testid="checkin-codigo" className="text-4xl font-bold tracking-widest">
          {data.codigo}
        </p>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-4">
        {qrDataUrl ? (
          <img
            data-testid="checkin-qr"
            src={qrDataUrl}
            alt="QR Code do seu atendimento"
            className="h-64 w-64"
          />
        ) : (
          <div className="grid h-64 w-64 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <p className="max-w-sm text-sm text-muted-foreground">
        Leia este QR Code com o seu telefone para acompanhar o atendimento. Ele não contém os seus
        dados pessoais.
      </p>

      <Link
        to="/totem"
        onClick={() => reset()}
        className="mt-2 h-14 rounded-xl border border-border px-8 text-sm font-bold uppercase leading-[3.5rem] tracking-wider"
      >
        Concluir
      </Link>
    </div>
  );
}
