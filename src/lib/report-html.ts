import { formatCurrency, formatDate } from "@/lib/format";

export interface ReportRow {
  id: string;
  created_at: string;
  data_pagamento: string;
  nome_cliente: string;
  artist_id: string | null;
  tatuador: string | null;
  recebido_por_app_user_id: string | null;
  recebido_por_nome: string | null;
  registrado_por_nome: string | null;
  link_origem: string;
  tipo_movimento: string;
  valor_cartao: number;
  valor_dinheiro: number;
  valor_sumup: number;
  valor_transferencia: number;
  total: number;
  ghl_sync_status: "pending" | "synced" | "failed";
  data_tatuagem?: string | null;
  descricao_projeto?: string | null;
}

export interface BreakdownItem {
  label: string;
  value: number;
  count: number;
  pct: number;
}

export interface ReportAggregates {
  total: number;
  count: number;
  ticketMedio: number;
  pendenteValor: number;
  pendenteCount: number;
  porForma: BreakdownItem[];
  porTatuador: BreakdownItem[];
  porTipo: BreakdownItem[];
}

export const TIPO_LABELS: Record<string, string> = {
  sinal: "Sinal",
  sessao: "Sessão",
  saldo: "Saldo",
  produto: "Produto",
  estorno: "Estorno",
};

function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function sortDesc(items: BreakdownItem[]): BreakdownItem[] {
  return [...items].sort((a, b) => b.value - a.value);
}

export function aggregateReport(rows: ReportRow[]): ReportAggregates {
  const total = rows.reduce((s, r) => s + r.total, 0);
  const count = rows.length;

  const formas: Array<[string, (r: ReportRow) => number]> = [
    ["Cartão", (r) => r.valor_cartao],
    ["Dinheiro", (r) => r.valor_dinheiro],
    ["SumUp", (r) => r.valor_sumup],
    ["Transferência", (r) => r.valor_transferencia],
  ];

  const porForma = formas.map(([label, pick]) => {
    const value = rows.reduce((s, r) => s + pick(r), 0);
    const c = rows.filter((r) => pick(r) > 0).length;
    return { label, value, count: c, pct: pct(value, total) };
  });

  const byArtist = new Map<string, { value: number; count: number }>();
  for (const r of rows) {
    const key = r.tatuador ?? "Sem tatuador";
    const cur = byArtist.get(key) ?? { value: 0, count: 0 };
    byArtist.set(key, { value: cur.value + r.total, count: cur.count + 1 });
  }

  const byTipo = new Map<string, { value: number; count: number }>();
  for (const r of rows) {
    const key = TIPO_LABELS[r.tipo_movimento] ?? r.tipo_movimento;
    const cur = byTipo.get(key) ?? { value: 0, count: 0 };
    byTipo.set(key, { value: cur.value + r.total, count: cur.count + 1 });
  }

  const pendentes = rows.filter((r) => r.ghl_sync_status !== "synced");

  return {
    total,
    count,
    ticketMedio: count > 0 ? total / count : 0,
    pendenteValor: pendentes.reduce((s, r) => s + r.total, 0),
    pendenteCount: pendentes.length,
    porForma: sortDesc(porForma),
    porTatuador: sortDesc(
      [...byArtist].map(([label, v]) => ({ label, ...v, pct: pct(v.value, total) })),
    ),
    porTipo: sortDesc(
      [...byTipo].map(([label, v]) => ({ label, ...v, pct: pct(v.value, total) })),
    ),
  };
}

export function metodoLabel(r: ReportRow): string {
  const parts: string[] = [];
  if (r.valor_cartao > 0) parts.push("Cartão");
  if (r.valor_dinheiro > 0) parts.push("Dinheiro");
  if (r.valor_sumup > 0) parts.push("SumUp");
  if (r.valor_transferencia > 0) parts.push("Transferência");
  if (parts.length === 0) return "—";
  return parts.join(" + ");
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface ReportMeta {
  periodoLabel: string;
  geradoPor: string;
  geradoEm: Date;
  origemLabel?: string;
  filtrosLabel?: string;
}

function breakdownHtml(title: string, items: BreakdownItem[]): string {
  if (items.length === 0) return "";
  const rows = items
    .map(
      (i) => `<tr>
        <td>${esc(i.label)}</td>
        <td class="num">${esc(i.count)}</td>
        <td class="num">${esc(formatCurrency(i.value))}</td>
        <td class="num">${esc(i.pct)}%</td>
      </tr>`,
    )
    .join("");
  return `<section>
    <h2>${esc(title)}</h2>
    <table>
      <thead><tr><th>Descrição</th><th class="num">Nº</th><th class="num">Valor</th><th class="num">%</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

export function buildReportHtml(
  rows: ReportRow[],
  agg: ReportAggregates,
  meta: ReportMeta,
): string {
  const detalhe = rows
    .map(
      (r) => `<tr>
        <td>${esc(formatDate(r.data_pagamento))}</td>
        <td>${esc(r.nome_cliente)}</td>
        <td>${esc(r.descricao_projeto ?? "—")}</td>
        <td>${esc(r.data_tatuagem ? formatDate(r.data_tatuagem) : "—")}</td>
        <td>${esc(r.tatuador ?? "—")}</td>
        <td>${esc(r.recebido_por_nome ?? "—")}</td>
        <td>${esc(r.registrado_por_nome ?? "—")}</td>
        <td>${esc(TIPO_LABELS[r.tipo_movimento] ?? r.tipo_movimento)}</td>
        <td>${esc(metodoLabel(r))}</td>
        <td class="num">${esc(formatCurrency(r.total))}</td>
        <td>${r.ghl_sync_status === "synced" ? "Sincronizado" : "Pendente"}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(meta.origemLabel ?? "Relatório de pagamentos")} — ${esc(meta.periodoLabel)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #18181b; background: #fff; font-size: 13px; }
  header { border-bottom: 2px solid #18181b; padding-bottom: 12px; margin-bottom: 20px; }
  h1 { font-size: 18px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em; }
  .meta { font-size: 11px; color: #52525b; }
  .cards { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 22px; }
  .card { flex: 1 1 140px; border: 1px solid #e4e4e7; border-radius: 8px; padding: 10px 12px; }
  .card .k { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; }
  .card .v { font-size: 17px; font-weight: 700; margin-top: 2px; }
  section { margin-bottom: 22px; page-break-inside: avoid; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #52525b; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e4e4e7; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 700; border-top: 2px solid #18181b; border-bottom: none; }
  @page { size: A4; margin: 14mm; }
</style>
</head>
<body>
<header>
  <h1>GF Tattoo — ${esc(meta.origemLabel ?? "Relatório de pagamentos")}</h1>
  <div class="meta">Período: ${esc(meta.periodoLabel)}</div>
  ${meta.filtrosLabel ? `<div class="meta">Filtros: ${esc(meta.filtrosLabel)}</div>` : ""}
  <div class="meta">Gerado por ${esc(meta.geradoPor)} em ${esc(formatDate(meta.geradoEm))}</div>
</header>

<div class="cards">
  <div class="card"><div class="k">Total recebido</div><div class="v">${esc(formatCurrency(agg.total))}</div></div>
  <div class="card"><div class="k">Pagamentos</div><div class="v">${esc(agg.count)}</div></div>
  <div class="card"><div class="k">Ticket médio</div><div class="v">${esc(formatCurrency(agg.ticketMedio))}</div></div>
  <div class="card"><div class="k">Sync pendente</div><div class="v">${esc(formatCurrency(agg.pendenteValor))}</div></div>
</div>

${breakdownHtml("Totais por forma de pagamento", agg.porForma)}
${breakdownHtml("Totais por tatuador", agg.porTatuador)}
${breakdownHtml("Totais por tipo de movimento", agg.porTipo)}

<section>
  <h2>Detalhe dos pagamentos</h2>
  <table>
    <thead><tr><th>Data</th><th>Cliente</th><th>Projeto</th><th>Data tatuagem</th><th>Tatuador</th><th>Recebido por</th><th>Registado por</th><th>Tipo</th><th>Formas</th><th class="num">Total</th><th>GHL</th></tr></thead>
    <tbody>${detalhe || `<tr><td colspan="11">Sem pagamentos no período.</td></tr>`}</tbody>
    <tfoot><tr><td colspan="9">Total</td><td class="num">${esc(formatCurrency(agg.total))}</td><td></td></tr></tfoot>
  </table>
</section>
</body>
</html>`;
}

export function downloadReportHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const CSV_COLUMNS: Array<{ label: string; pick: (r: ReportRow) => unknown }> = [
  { label: "Data", pick: (r) => r.data_pagamento },
  { label: "Cliente", pick: (r) => r.nome_cliente },
  { label: "Descrição do projeto", pick: (r) => r.descricao_projeto ?? "" },
  { label: "Data da tatuagem", pick: (r) => r.data_tatuagem ?? "" },
  { label: "Tatuador", pick: (r) => r.tatuador ?? "" },
  { label: "Recebido por", pick: (r) => r.recebido_por_nome ?? "" },
  { label: "Registado por", pick: (r) => r.registrado_por_nome ?? "" },
  { label: "Tipo", pick: (r) => TIPO_LABELS[r.tipo_movimento] ?? r.tipo_movimento },
  { label: "Cartão", pick: (r) => r.valor_cartao },
  { label: "Dinheiro", pick: (r) => r.valor_dinheiro },
  { label: "SumUp", pick: (r) => r.valor_sumup },
  { label: "Transferência", pick: (r) => r.valor_transferencia },
  { label: "Total", pick: (r) => r.total },
  { label: "GHL", pick: (r) => (r.ghl_sync_status === "synced" ? "Sincronizado" : "Pendente") },
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportReportCSV(rows: ReportRow[], filename: string, meta?: ReportMeta) {
  const header = CSV_COLUMNS.map((c) => csvEscape(c.label)).join(";");
  const body = rows
    .map((r) => CSV_COLUMNS.map((c) => csvEscape(c.pick(r))).join(";"))
    .join("\r\n");
  const preamble = meta
    ? [
        `${csvEscape("Período")};${csvEscape(meta.periodoLabel)}`,
        `${csvEscape("Filtros")};${csvEscape(meta.filtrosLabel ?? "Sem filtros")}`,
        `${csvEscape("Gerado por")};${csvEscape(meta.geradoPor)}`,
        `${csvEscape("Gerado em")};${csvEscape(formatDate(meta.geradoEm))}`,
        "",
      ].join("\r\n") + "\r\n"
    : "";
  const csv = "\uFEFF" + preamble + header + "\r\n" + body;
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