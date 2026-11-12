import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TotemDoneView } from "@/components/checkin/totem-views";
import { getCheckinByToken } from "@/lib/checkin.functions";
import { useTotemDraft } from "@/stores/totem-checkin";

export const Route = createFileRoute("/totem/pronto")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Seu check-in — GF Tattoo" },
      { name: "description", content: "Confira o registro de chegada e acompanhe o atendimento." },
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
  const navigate = useNavigate();
  const fetchCheckin = useServerFn(getCheckinByToken);
  const reset = useTotemDraft((s) => s.reset);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["checkin", token],
    queryFn: () => fetchCheckin({ data: { token } }),
    enabled: Boolean(token),
  });

  const qrUrl = token ? `${window.location.origin}/a/${token}` : "";

  useEffect(() => {
    if (!qrUrl) return;
    let cancelled = false;
    setQrDataUrl(null);
    setQrFailed(false);
    void (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const url = await QRCode.toDataURL(qrUrl, {
          width: 420,
          margin: 1,
          errorCorrectionLevel: "M",
        });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        if (!cancelled) setQrFailed(true);
      }
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
    <TotemDoneView
      data={token ? data : null}
      loading={Boolean(token) && isLoading}
      error={Boolean(error)}
      qrDataUrl={qrDataUrl}
      qrFailed={qrFailed}
      onRetry={() => void refetch()}
      onDone={() => {
        reset();
        navigate({ to: "/totem" });
      }}
    />
  );
}
