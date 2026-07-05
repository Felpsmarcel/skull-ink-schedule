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