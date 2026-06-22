import { supabase } from "@/integrations/supabase/client";

export type ServiceModality = "presencial" | "consulta_online" | "hibrido";

export interface Service {
  id: string;
  name: string;
  category: string;
  duration_min: number;
  modality: ServiceModality;
  /** Euros as a decimal number (e.g. 150 or 12.5). */
  price_eur: number;
  description: string | null;
  sort_order: number;
  active: boolean;
}

interface RawServiceRow {
  id: string;
  name: string;
  category: string;
  duration_min: number;
  modality: ServiceModality;
  price_eur: string | number;
  description: string | null;
  sort_order: number | null;
  active: boolean;
}

export async function fetchActiveServices(): Promise<Service[]> {
  // generated types don't know `services` yet — loose cast
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (k: string, v: boolean) => {
          order: (
            col: string,
            opts?: { ascending?: boolean },
          ) => {
            order: (
              col: string,
            ) => Promise<{ data: RawServiceRow[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
  })
    .from("services")
    .select("id,name,category,duration_min,modality,price_eur,description,sort_order,active")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map<Service>((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    duration_min: r.duration_min,
    modality: r.modality,
    // numeric(8,2) often comes back as a string from PostgREST
    price_eur: typeof r.price_eur === "string" ? Number(r.price_eur) : r.price_eur,
    description: r.description,
    sort_order: r.sort_order ?? 0,
    active: r.active,
  }));
}

const eurFmt = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });

export function formatPrice(eur: number): string {
  return eurFmt.format(Number.isFinite(eur) ? eur : 0);
}

const MODALITY_LABELS: Record<ServiceModality, string> = {
  presencial: "Presencial",
  consulta_online: "Consulta online",
  hibrido: "Híbrido",
};

export function modalityLabel(m: ServiceModality): string {
  return MODALITY_LABELS[m] ?? m;
}