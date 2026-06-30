import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge, type StatusVariant } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useArtists } from "@/hooks/use-artists";
import {
  exportMonthlyReportCSV,
  useMonthlyReport,
  type MonthlyReportRow,
} from "@/hooks/use-monthly-report";
import { getContact } from "@/lib/ghl";

export const Route = createFileRoute("/_authenticated/_admin/relatorios/agendamentos")({
  head: () => ({ meta: [{ title: "Relatório mensal — GF Tattoo Studio" }] }),
  component: MonthlyReportPage,
});

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "agendado", label: "Agendado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
  { value: "no_show", label: "No-show" },
];

function statusVariant(s: string | null): StatusVariant {
  if (s === "concluido") return "success";
  if (s === "confirmado") return "info";
  if (s === "cancelado" || s === "no_show") return "danger";
  return "warning";
}

function fmtMoney(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v);
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("pt-PT", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return s; }
}

function MonthlyReportPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [artistId, setArtistId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [style, setStyle] = useState<string>("");
  const [selectedContact, setSelectedContact] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      month,
      year,
      artistId: artistId || null,
      status: status || null,
      style: style.trim() || null,
    }),
    [month, year, artistId, status, style],
  );

  const { data: artists } = useArtists();
  const { data: rows, isLoading, error, refetch } = useMonthlyReport(filters);

  function handleExport() {
    if (!rows || rows.length === 0) {
      toast.error("Nada para exportar");
      return;
    }
    const name = `relatorio-${year}-${String(month).padStart(2, "0")}.csv`;
    exportMonthlyReportCSV(rows, name);
    toast.success(`Exportado: ${rows.length} linha(s)`);
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl uppercase tracking-wider">Relatório mensal</h1>
          <p className="text-xs text-muted-foreground">Agendamentos do período selecionado</p>
        </div>
        <Button onClick={handleExport} disabled={!rows || rows.length === 0}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-5">
        <LabeledSelect label="Mês" value={String(month)} onChange={(v) => setMonth(Number(v))}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </LabeledSelect>
        <LabeledSelect label="Ano" value={String(year)} onChange={(v) => setYear(Number(v))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </LabeledSelect>
        <LabeledSelect label="Artista" value={artistId} onChange={setArtistId}>
          <option value="">Todos</option>
          {(artists ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </LabeledSelect>
        <LabeledSelect label="Status" value={status} onChange={setStatus}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </LabeledSelect>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Estilo
          </label>
          <Input
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="ex.: blackwork"
            className="h-9"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState label="Carregando relatório..." />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="Sem agendamentos"
          description="Nenhum registro para os filtros selecionados."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Artista</TableHead>
                <TableHead>Estilo</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>GHL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">{fmtDate(r.data_e_hora)}</TableCell>
                  <TableCell className="text-sm font-medium">{r.nome_do_cliente ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.artista ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.estilo_de_tatuagem ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.tamanho_da_tatuagem ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge variant={statusVariant(r.status_pt)}>
                      {r.status_pt ?? "—"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{fmtMoney(r.valor)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{fmtMoney(r.comissao_eur)}</TableCell>
                  <TableCell>
                    {r.ghl_contact_id ? (
                      <button
                        type="button"
                        onClick={() => setSelectedContact(r.ghl_contact_id)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-wider hover:bg-muted"
                      >
                        <ExternalLink className="h-3 w-3" /> Ver
                      </button>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        não vinculado
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <GhlContactSheet
        contactId={selectedContact}
        onClose={() => setSelectedContact(null)}
      />
    </div>
  );
}

function LabeledSelect({
  label, value, onChange, children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      >
        {children}
      </select>
    </div>
  );
}

function GhlContactSheet({
  contactId, onClose,
}: { contactId: string | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ghl-contact", contactId],
    queryFn: async () => {
      const r = await getContact(contactId!);
      if (!r.ok) throw new Error(`GHL ${r.status}`);
      return r.data.contact ?? null;
    },
    enabled: !!contactId,
    staleTime: 5 * 60_000,
  });

  return (
    <Sheet open={!!contactId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Contato GHL</SheetTitle>
          <SheetDescription className="text-xs">{contactId}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3 text-sm">
          {isLoading ? (
            <LoadingState label="Buscando..." />
          ) : error ? (
            <ErrorState message={(error as Error).message} />
          ) : !data ? (
            <p className="text-muted-foreground">Sem dados.</p>
          ) : (
            <dl className="space-y-2">
              <Field label="Nome" value={data.contactName ?? `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim()} />
              <Field label="Telefone" value={data.phone} />
              <Field label="Email" value={data.email} />
              <Field label="Source" value={data.source} />
              <Field label="Assigned to" value={data.assignedTo} />
              <Field
                label="Tags"
                value={data.tags && data.tags.length > 0 ? data.tags.join(", ") : undefined}
              />
            </dl>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border pb-1">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-right">{value || "—"}</dd>
    </div>
  );
}