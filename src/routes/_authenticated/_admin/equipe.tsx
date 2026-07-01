import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { inviteArtist, listTeam } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/_admin/equipe")({
  head: () => ({ meta: [{ title: "Equipe — GF Tattoo Studio" }] }),
  component: EquipePage,
});

function EquipePage() {
  const list = useServerFn(listTeam);
  const invite = useServerFn(inviteArtist);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["team"], queryFn: () => list() });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [ghlUserId, setGhlUserId] = useState("");
  const [commissionPct, setCommissionPct] = useState(40);

  const m = useMutation({
    mutationFn: async () => {
      return invite({
        data: {
          name: name.trim(),
          email: email.trim(),
          calendarId: calendarId.trim(),
          ghlUserId: ghlUserId.trim() || null,
          commissionPct,
          redirectTo: `${window.location.origin}/auth/update-password`,
        },
      });
    },
    onSuccess: (r) => {
      toast.success(r.reused ? "Artista vinculado a usuário existente." : "Convite enviado por email.");
      setName("");
      setEmail("");
      setCalendarId("");
      setGhlUserId("");
      setCommissionPct(40);
      qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Falha ao convidar");
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
      <Toaster position="top-center" />
      <h1 className="mb-1 text-xl font-bold uppercase tracking-wider">Equipe</h1>
      <p className="mb-6 text-xs text-muted-foreground">
        Cadastre o tatuador e envie o convite. Ele receberá um email para definir a senha e
        entrar no app.
      </p>

      <section className="mb-8 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">Novo tatuador</h2>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name || !email || !calendarId) {
              toast.error("Nome, email e calendarId são obrigatórios.");
              return;
            }
            m.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="calendarId">GHL Calendar ID</Label>
            <Input
              id="calendarId"
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ghlUserId">GHL User ID (opcional)</Label>
            <Input
              id="ghlUserId"
              value={ghlUserId}
              onChange={(e) => setGhlUserId(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="commission">Comissão (%)</Label>
            <Input
              id="commission"
              type="number"
              min={0}
              max={100}
              value={commissionPct}
              onChange={(e) => setCommissionPct(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={m.isPending} className="w-full">
              {m.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Convidar
            </Button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">Tatuadores</h2>
        {q.isLoading ? (
          <LoadingState label="Carregando equipe…" />
        ) : q.isError ? (
          <ErrorState
            description={q.error instanceof Error ? q.error.message : "Falha"}
            onRetry={() => {
              void q.refetch();
            }}
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {(q.data?.artists ?? []).map((a) => (
              <li key={a.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{a.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    cal: {a.calendarId ?? "—"} · comissão {a.commissionPct}%
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {a.users.length === 0
                      ? "Sem usuário vinculado"
                      : a.users.map((u) => u.email ?? u.id.slice(0, 8)).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge variant={a.users.length > 0 ? "success" : "warning"}>
                    {a.users.length > 0 ? "vinculado" : "pendente"}
                  </StatusBadge>
                  <StatusBadge variant={a.active ? "info" : "neutral"}>
                    {a.active ? "ativo" : "inativo"}
                  </StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}