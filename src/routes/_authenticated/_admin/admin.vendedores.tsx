import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus, Pencil, Trash2, Send, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  createSeller,
  deleteSeller,
  updateSeller,
} from "@/lib/sellers.functions";
import {
  inviteSeller,
  listSellersWithUsers,
  repairSellerLink,
  type SellerWithUsers,
} from "@/lib/sellers-invite.functions";

export const Route = createFileRoute("/_authenticated/_admin/admin/vendedores")({
  head: () => ({
    meta: [
      { title: "Vendedores — GF Tattoo Studio" },
      { name: "description", content: "Gestão de vendedores do GF Tattoo Studio." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: VendedoresPage,
});

type FormState = {
  id?: string;
  name: string;
  commissionPct: number;
  active: boolean;
};

const EMPTY_FORM: FormState = { name: "", commissionPct: 0, active: true };

function VendedoresPage() {
  const list = useServerFn(listSellersWithUsers);
  const create = useServerFn(createSeller);
  const update = useServerFn(updateSeller);
  const remove = useServerFn(deleteSeller);
  const invite = useServerFn(inviteSeller);
  const repair = useServerFn(repairSellerLink);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["sellers", "with-users"],
    queryFn: () => list(),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const saveM = useMutation({
    mutationFn: async () => {
      if (form.id) {
        return update({
          data: {
            id: form.id,
            name: form.name.trim(),
            commissionPct: form.commissionPct,
            active: form.active,
          },
        });
      }
      return create({
        data: {
          name: form.name.trim(),
          commissionPct: form.commissionPct,
          active: form.active,
        },
      });
    },
    onSuccess: () => {
      toast.success(form.id ? "Vendedor atualizado." : "Vendedor criado.");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["sellers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Vendedor desativado.");
      qc.invalidateQueries({ queryKey: ["sellers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  function openNew() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }
  function openEdit(s: SellerWithUsers) {
    setForm({ id: s.id, name: s.name, commissionPct: s.commissionPct, active: s.active });
    setDialogOpen(true);
  }

  const sellers = q.data ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
      <Toaster position="top-center" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider">Vendedores</h1>
          <p className="text-xs text-muted-foreground">
            Cadastre e edite os vendedores e a comissão de cada um.
          </p>
        </div>
        <Button onClick={openNew}>
          <UserPlus className="mr-2 h-4 w-4" /> Novo
        </Button>
      </div>

      {q.isLoading ? (
        <LoadingState label="Carregando vendedores…" />
      ) : q.isError ? (
        <ErrorState
          description={q.error instanceof Error ? q.error.message : "Falha"}
          onRetry={() => { void q.refetch(); }}
        />
      ) : sellers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Nenhum vendedor cadastrado.
        </p>
      ) : (
        <ul className="space-y-2">
          {sellers.map((s) => (
            <SellerCard
              key={s.id}
              seller={s}
              onEdit={() => openEdit(s)}
              onDelete={() => deleteM.mutate(s.id)}
              canDelete={s.active && !deleteM.isPending}
              invite={invite}
              repair={repair}
              onRefresh={() => qc.invalidateQueries({ queryKey: ["sellers"] })}
            />
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar vendedor" : "Novo vendedor"}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim()) {
                toast.error("Nome é obrigatório.");
                return;
              }
              saveM.mutate();
            }}
          >
            <div className="space-y-1 sm:col-span-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Comissão (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.commissionPct}
                onChange={(e) =>
                  setForm({ ...form, commissionPct: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.active ? "1" : "0"}
                onChange={(e) => setForm({ ...form, active: e.target.value === "1" })}
              >
                <option value="1">Ativo</option>
                <option value="0">Inativo</option>
              </select>
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveM.isPending}>
                {saveM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SellerCard({
  seller,
  onEdit,
  onDelete,
  canDelete,
  invite,
  repair,
  onRefresh,
}: {
  seller: SellerWithUsers;
  onEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
  invite: ReturnType<typeof useServerFn<typeof inviteSeller>>;
  repair: ReturnType<typeof useServerFn<typeof repairSellerLink>>;
  onRefresh: () => void;
}) {
  const [email, setEmail] = useState(seller.users[0]?.email ?? "");

  const inviteM = useMutation({
    mutationFn: async () =>
      invite({
        data: {
          sellerId: seller.id,
          email: email.trim(),
          redirectTo: `${window.location.origin}/auth/update-password`,
        },
      }),
    onSuccess: (r) => {
      if (!r.linkOk) {
        toast.error(
          `Convite enviado mas vínculo falhou: ${r.linkError ?? "erro desconhecido"}. Use "Reparar vínculo".`,
        );
      } else {
        toast.success(r.reused ? "Vinculado a usuário existente." : "Convite enviado.");
      }
      onRefresh();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Falha ao convidar";
      if (msg.toLowerCase().includes("already registered")) {
        toast.error('Usuário já existe. Use "Reparar vínculo" para vincular.');
      } else {
        toast.error(msg);
      }
    },
  });

  const repairM = useMutation({
    mutationFn: async () => repair({ data: { sellerId: seller.id, email: email.trim() } }),
    onSuccess: () => {
      toast.success("Vínculo reparado.");
      onRefresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao reparar"),
  });

  const linkedEmails = seller.users.map((u) => u.email ?? u.id.slice(0, 8));

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{seller.name}</p>
            <StatusBadge variant={seller.active ? "info" : "neutral"}>
              {seller.active ? "ativo" : "inativo"}
            </StatusBadge>
            <StatusBadge variant={seller.users.length > 0 ? "success" : "warning"}>
              {seller.users.length > 0 ? "vinculado" : "sem usuário"}
            </StatusBadge>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            comissão {seller.commissionPct}%
          </p>
          <p className="text-[11px] text-muted-foreground">
            {linkedEmails.length === 0 ? "Nenhum usuário vinculado" : linkedEmails.join(", ")}
          </p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {canDelete ? (
            <Button size="sm" variant="outline" onClick={onDelete} aria-label="Desativar">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
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
              if (!email.trim()) {
                toast.error("Informe o email.");
                return;
              }
              inviteM.mutate();
            }}
            disabled={inviteM.isPending}
          >
            {inviteM.isPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-2 h-3.5 w-3.5" />
            )}
            {seller.users.length > 0 ? "Reenviar" : "Convidar"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!email.trim()) {
                toast.error("Informe o email.");
                return;
              }
              repairM.mutate();
            }}
            disabled={repairM.isPending}
          >
            {repairM.isPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Link2 className="mr-2 h-3.5 w-3.5" />
            )}
            Reparar vínculo
          </Button>
        </div>
      </div>
    </li>
  );
}