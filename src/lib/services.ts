import { supabase } from "@/integrations/supabase/client";

export interface Service {
  id: string;
  name: string;
  category: string;
  duration_min: number;
  modality: string;
  price_cents: number;
  currency: string;
  active: boolean;
}

export async function fetchActiveServices(): Promise<Service[]> {
  // The generated `Database` type doesn't know about `services` yet — cast loosely.
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (k: string, v: boolean) => {
          order: (
            col: string,
            opts?: { ascending?: boolean },
          ) => Promise<{ data: Service[] | null; error: { message: string } | null }>;
        };
      };
    };
  })
    .from("services")
    .select("id,name,category,duration_min,modality,price_cents,currency,active")
    .eq("active", true)
    .order("category", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

const eurFmt = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

export function formatPrice(cents: number, currency = "EUR"): string {
  const amount = cents / 100;
  if (currency === "EUR") return eurFmt.format(amount);
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(amount);
}