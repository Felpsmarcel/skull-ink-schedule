import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";
import { getWeeklyAvailability, setWeeklyAvailability } from "@/lib/onboarding.functions";

const DAYS = [
  { i: 1, label: "Segunda" },
  { i: 2, label: "Terça" },
  { i: 3, label: "Quarta" },
  { i: 4, label: "Quinta" },
  { i: 5, label: "Sexta" },
  { i: 6, label: "Sábado" },
  { i: 0, label: "Domingo" },
];

type Row = { enabled: boolean; start: string; end: string };

export const Route = createFileRoute("/_authenticated/onboarding/disponibilidade")({
  head: () => ({ meta: [{ title: "Disponibilidade — GF Tattoo Studio" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AvailabilityStep,
});

function AvailabilityStep() {
  const navigate = useNavigate();
  const fetchAvail = useServerFn(getWeeklyAvailability);
  const saveAvail = useServerFn(setWeeklyAvailability);
  const { data } = useQuery({ queryKey: ["my-weekly-availability"], queryFn: () => fetchAvail() });

  const [rows, setRows] = useState<Record<number, Row>>(() =>
    Object.fromEntries(DAYS.map((d) => [d.i, { enabled: d.i >= 1 && d.i <= 5, start: "10:00", end: "19:00" }])),
  );

  useEffect(() => {
    if (!data) return;
    setRows((prev) => {
      const next: Record<number, Row> = { ...prev };
      for (const d of DAYS) next[d.i] = { enabled: false, start: "10:00", end: "19:00" };
      for (const slot of data) {
        next[slot.weekday] = {
          enabled: true,
          start: slot.start_time.slice(0, 5),
          end: slot.end_time.slice(0, 5),
        };
      }
      return next;
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      saveAvail({
        data: {
          slots: DAYS.filter((d) => rows[d.i]?.enabled).map((d) => ({
            weekday: d.i,
            start_time: rows[d.i].start,
            end_time: rows[d.i].end,
          })),
        },
      }),
    onSuccess: () => navigate({ to: "/onboarding/servicos" }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <Toaster position="top-center" />
      <div>
        <h1 className="text-xl font-bold">Seus horários</h1>
        <p className="text-sm text-muted-foreground">Marque os dias em que atende e o intervalo.</p>
      </div>

      <div className="space-y-2">
        {DAYS.map((d) => {
          const r = rows[d.i];
          return (
            <div key={d.i} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <Switch
                checked={r.enabled}
                onCheckedChange={(v) => setRows((p) => ({ ...p, [d.i]: { ...p[d.i], enabled: v } }))}
              />
              <span className="w-20 text-sm">{d.label}</span>
              <Input
                type="time"
                value={r.start}
                disabled={!r.enabled}
                onChange={(e) => setRows((p) => ({ ...p, [d.i]: { ...p[d.i], start: e.target.value } }))}
                className="w-28"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="time"
                value={r.end}
                disabled={!r.enabled}
                onChange={(e) => setRows((p) => ({ ...p, [d.i]: { ...p[d.i], end: e.target.value } }))}
                className="w-28"
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" asChild className="flex-1">
          <Link to="/onboarding/servicos">Pular por agora</Link>
        </Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="flex-1">
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Continuar
        </Button>
      </div>
    </div>
  );
}