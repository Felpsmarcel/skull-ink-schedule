import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MonthlyReportRow =
  Database["public"]["Functions"]["get_monthly_report"]["Returns"][number];

export interface MonthlyReportFilters {
  month: number;
  year: number;
  artistId?: string | null;
  status?: string | null;
  style?: string | null;
}

async function fetchMonthlyReport(f: MonthlyReportFilters): Promise<MonthlyReportRow[]> {
  const { data, error } = await supabase.rpc("get_monthly_report", {
    p_month: f.month,
    p_year: f.year,
    p_artist: f.artistId ?? undefined,
    p_status: f.status ?? undefined,
    p_style: f.style ?? undefined,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as MonthlyReportRow[];
}

export function useMonthlyReport(filters: MonthlyReportFilters) {
  return useQuery({
    queryKey: ["monthly-report", filters],
    queryFn: () => fetchMonthlyReport(filters),
    staleTime: 30_000,
  });
}

const COLUMNS: Array<{ key: keyof MonthlyReportRow; label: string }> = [
  { key: "data_e_hora", label: "Data e hora" },
  { key: "nome_do_cliente", label: "Cliente" },
  { key: "artista", label: "Artista" },
  { key: "estilo_de_tatuagem", label: "Estilo" },
  { key: "tamanho_da_tatuagem", label: "Tamanho" },
  { key: "status_pt", label: "Status" },
  { key: "valor", label: "Valor (EUR)" },
  { key: "comissao_pct", label: "Comissão (%)" },
  { key: "comissao_eur", label: "Comissão (EUR)" },
  { key: "notas", label: "Notas" },
  { key: "ghl_contact_id", label: "GHL Contact" },
  { key: "ghl_calendar_id", label: "GHL Calendar" },
  { key: "criado_em", label: "Criado em" },
  { key: "id", label: "ID" },
];

function escape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportMonthlyReportCSV(rows: MonthlyReportRow[], filename: string) {
  const header = COLUMNS.map((c) => escape(c.label)).join(";");
  const body = rows
    .map((r) => COLUMNS.map((c) => escape(r[c.key])).join(";"))
    .join("\r\n");
  const csv = "\uFEFF" + header + "\r\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}