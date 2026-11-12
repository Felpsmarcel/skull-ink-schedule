export type FinanceArea = "projects" | "receipts" | "sessions" | "payouts";
export type WorkspacePeriod = "today" | "week" | "month" | "all" | "custom";
export interface WorkspaceFilters {
  area: FinanceArea;
  period: WorkspacePeriod;
  from: string;
  to: string;
  artist: string;
}
export interface FinanceSource<T> {
  state: "complete" | "unavailable";
  rows: T[];
}
export interface FinanceProject {
  id: string;
  title: string;
  client: string | null;
  artistId: string | null;
  artist: string | null;
  date: string;
  status: string;
  quotedCents: number | null;
  opportunityId: string | null;
}
export interface FinanceReceipt {
  id: string;
  client: string;
  artistId: string;
  artist: string | null;
  date: string;
  kind: string;
  amountCents: number | null;
  projectId: string | null;
  appointmentId: string | null;
  methods: string[];
  sync: string;
}
export interface FinanceSession {
  id: string;
  client: string | null;
  artistId: string;
  artist: string | null;
  date: string;
  status: string;
  projectId: string | null;
  /** Omitted entirely from non-admin responses. */
  amountCents?: number | null;
  sellerId?: string | null;
  seller?: string | null;
  sellerCommissionCents?: number | null;
  commissionCents: number | null;
  commissionPct: number | null;
  excluded: boolean;
}
export interface FinanceWorkspaceData {
  role: "admin" | "artist" | "seller";
  updatedAt: string;
  artists: Array<{ id: string; name: string }>;
  projects: FinanceSource<FinanceProject>;
  receipts: FinanceSource<FinanceReceipt>;
  sessions: FinanceSource<FinanceSession>;
}
export interface WorkspaceMetric {
  label: string;
  value: number | null;
  kind: "money" | "count";
  note: string;
}
export interface FinanceWorkspaceModel {
  area: FinanceArea;
  metrics: WorkspaceMetric[];
  projects: FinanceProject[];
  receipts: FinanceReceipt[];
  sessions: FinanceSession[];
  sourceAvailable: boolean;
  invalidPeriod: boolean;
}
