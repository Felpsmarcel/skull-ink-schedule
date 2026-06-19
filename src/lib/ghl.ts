import { supabase } from "@/integrations/supabase/client";

export interface GhlFetchParams {
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  version?: string;
}

export interface GhlFetchResult<T = unknown> {
  status: number;
  ok: boolean;
  data: T;
  url?: string;
}

export async function ghlFetch<T = unknown>(params: GhlFetchParams): Promise<GhlFetchResult<T>> {
  const { data, error } = await supabase.functions.invoke("ghl-proxy", { body: params });
  if (error) throw new Error(`ghl-proxy invoke error: ${error.message}`);
  return data as GhlFetchResult<T>;
}