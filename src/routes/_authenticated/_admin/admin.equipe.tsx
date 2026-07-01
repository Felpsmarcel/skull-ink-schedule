import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus, Send, Link2, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { inviteArtist, listTeam, repairArtistLink, upsertArtist } from "@/lib/team.functions";
import { getGhlSyncStatus, scheduleGhlSync } from "@/lib/ghl-sync-admin.functions";

export const Route = createFileRoute("/_authenticated/_admin/admin/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — GF Tattoo Studio" },
      { name: "description", content: "Gestão da equipe do GF Tattoo Studio." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: EquipePage,
});

type ArtistRow = {
  id: string;
  name: string;
  phone: string | null;
  calendarId: string | null;
  ghlUserId: string | null;
  commissionPct: number;
  active: boolean;
  users: Array<{ id: string; email: string | null }>;
};

type FormState = {
  id?: string;
  name: string;
  phone: string;
  calendarId: string;
  ghlUserId: string;
  commissionPct: number;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  phone: "",
  calendarId: "",
  ghlUserId: "",
  commissionPct: 40,
  active: true,
};

function EquipePage() {
  const list = useServerFn(listTeam);
  const upsert = useServerFn(upsertArtist);
  const invite = useServerFn(inviteArtist);
  const repair = useServerFn(repairArtistLink);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["team"], queryFn: () => list() });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const upsertM = useMutation({
    mutationFn: async () => upsert({
      data: {
        id: form.id,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        calendarId: form.calendarId.trim() || null,
        ghlUserId: form.ghlUserId.trim() || null,
        commissionPct: form.commissionPct,
        active: form.active,
      },
    }),
    onSuccess: () => {
      toast.success(form.id ? "Artista atualizado." : "Artista criado.");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  function openNew() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }
  function openEdit(a: ArtistRow) {
    setForm({
      id: a.id,
      name: a.name,
      phone: a.phone ?? "",
      calendarId: a.calendarId ?? "",
      ghlUserId: a.ghlUserId ?? "",
      commissionPct: a.commissionPct,
      active: a.active,
    });
    setDialogOpen(true);
  }

  const artists = (q.data?.artists ?? []) as ArtistRow[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
      <Toaster position="top-center" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider">Equipe</h1>
          <p className="text-xs text-muted-foreground">
            Cadastre, edite e convide tatuadores.
          </p>
        </div>
        <Button onClick={openNew}>
          <UserPlus className="mr-2 h-4 w-4" /> Novo
        </Button>
      </div>

      <CronStatusCard />

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider">Tatuadores</h2>
        {q.isLoading ? (
          <LoadingState label="Carregando equipe…" />
        ) : q.isError ? (
          <ErrorState
            description={q.error instanceof Error ? q.error.message : "Falha"}
            onRetry={() => { void q.refetch(); }}
          />
        ) : artists.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Nenhum artista cadastrado. Clique em "Novo" para começar.
          </p>
        ) : (
          <ul className="space-y-3">
            {artists.map((a) => (
              <ArtistCard
                key={a.id}
                artist={a}
                onEdit={() => openEdit(a)}
                invite={invite}
                repair={repair}
                onRefresh={() => qc.invalidateQueries({ queryKey: ["team"] })}
              />
            ))}
          </ul>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar tatuador" : "Novo tatuador"}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim()) { toast.error("Nome é obrigatório."); return; }
              if (form.active && form.calendarId.trim().length < 5) {
                toast.error("Artista ativo precisa de um GHL calendar ID.");
                return;
              }
              upsertM.mutate();
            }}
          >
            <Field label="Nome" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Telefone">
              <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="GHL Calendar ID">
              <Input value={form.calendarId} onChange={(e) => setForm({ ...form, calendarId: e.target.value })} />
            </Field>
            <Field label="GHL User ID">
              <Input value={form.ghlUserId} onChange={(e) => setForm({ ...form, ghlUserId: e.target.value })} />
            </Field>
            <Field label="Comissão (%)">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.commissionPct}
                onChange={(e) => setForm({ ...form, commissionPct: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Ativo">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.active ? "1" : "0"}
                onChange={(e) => setForm({ ...form, active: e.target.value === "1" })}
              >
                <option value="1">Ativo</option>
                <option value="0">Inativo</option>
              </select>
            </Field>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={upsertM.isPending}>
                {upsertM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}{required ? " *" : ""}</Label>
      {children}
    </div>
  );
}

function ArtistCard({
  artist,
  onEdit,
  invite,
  repair,
  onRefresh,
}: {
  artist: ArtistRow;
  onEdit: () => void;
  invite: ReturnType<typeof useServerFn<typeof inviteArtist>>;
  repair: ReturnType<typeof useServerFn<typeof repairArtistLink>>;
  onRefresh: () => void;
}) {
  const [email, setEmail] = useState(artist.users[0]?.email ?? "");

  const inviteM = useMutation({
    mutationFn: async () => invite({
      data: {
        artistId: artist.id,
        email: email.trim(),
        redirectTo: `${window.location.origin}/auth/update-password`,
      },
    }),
    onSuccess: (r) => {
      if (!r.linkOk) {
        toast.error(`Convite enviado mas vínculo falhou: ${r.linkError ?? "erro desconhecido"}. Use "Reparar vínculo".`);
      } else {
        toast.success(r.reused ? "Vinculado a usuário existente." : "Convite enviado.");
      }
      onRefresh();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Falha ao convidar";
      if (msg.toLowerCase().includes("already registered")) {
        toast.error("Usuário já existe. Use \"Reparar vínculo\" para vincular.");
      } else {
        toast.error(msg);
      }
    },
  });

  const repairM = useMutation({
    mutationFn: async () => repair({ data: { artistId: artist.id, email: email.trim() } }),
    onSuccess: () => { toast.success("Vínculo reparado."); onRefresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao reparar"),
  });

  const hasCalendar = !!artist.calendarId;
  const linkedEmails = artist.users.map((u) => u.email ?? u.id.slice(0, 8));

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{artist.name}</p>
            <StatusBadge variant={artist.active ? "info" : "neutral"}>
              {artist.active ? "ativo" : "inativo"}
            </StatusBadge>
            <StatusBadge variant={artist.users.length > 0 ? "success" : "warning"}>
              {artist.users.length > 0 ? "vinculado" : "sem usuário"}
            </StatusBadge>
            {!hasCalendar && (
              <StatusBadge variant="warning">sem calendário GHL</StatusBadge>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            cal: {artist.calendarId ?? "—"} · comissão {artist.commissionPct}%
            {artist.phone ? ` · ${artist.phone}` : ""}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {linkedEmails.length === 0 ? "Nenhum usuário vinculado" : linkedEmails.join(", ")}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          autoComplete="email"
          placeholder="email@dominio.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              if (!email.trim()) { toast.error("Informe o email."); return; }
              inviteM.mutate();
            }}
            disabled={inviteM.isPending}
          >
            {inviteM.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
            {artist.users.length > 0 ? "Reenviar" : "Convidar"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!email.trim()) { toast.error("Informe o email."); return; }
              repairM.mutate();
            }}
            disabled={repairM.isPending}
          >
            {repairM.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Link2 className="mr-2 h-3.5 w-3.5" />}
            Reparar vínculo
          </Button>
        </div>
      </div>
    </li>
  );
}

function CronStatusCard() {
  const status = useServerFn(getGhlSyncStatus);
  const schedule = useServerFn(scheduleGhlSync);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ghl-sync-status"], queryFn: () => status() });

  const m = useMutation({
    mutationFn: async () => schedule(),
    onSuccess: () => { toast.success("Cron agendado."); qc.invalidateQueries({ queryKey: ["ghl-sync-status"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  const job = q.data?.job;
  const vaultOk = q.data?.vault_ok;

  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider">Sync GHL</h2>
          <p className="text-[11px] text-muted-foreground">
            {q.isLoading
              ? "Carregando…"
              : job
                ? `Agendado: ${job.schedule} · ${job.active ? "ativo" : "pausado"}`
                : "Nenhum cron instalado."}
          </p>
          {q.data && !vaultOk && (
            <p className="mt-1 text-[11px] text-destructive">
              Vault secret `ghl_sync_anon_key` não configurado. Veja docs/ghl-sync.md.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending || !vaultOk}>
            {m.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            {job ? "Reagendar" : "Instalar cron"}
          </Button>
        </div>
      </div>
      {q.data?.runs?.length ? (
        <details className="mt-3 text-[11px]">
          <summary className="cursor-pointer text-muted-foreground">Últimas execuções</summary>
          <ul className="mt-2 space-y-1">
            {q.data.runs.map((r, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>{new Date(r.start_time).toLocaleString()}</span>
                <span className={r.status === "succeeded" ? "text-success" : "text-muted-foreground"}>
                  {r.status ?? "?"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}