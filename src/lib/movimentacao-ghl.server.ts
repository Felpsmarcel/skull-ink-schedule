// Server-only. Sincroniza uma linha de `movimentacoes` com um Custom Object
// no HighLevel. Best-effort: falha aqui NÃO desfaz o INSERT no Supabase.
//
// Estratégia:
// 1. Descobrir/registrar o `objectKey` do custom object `movimentacao_financeira`.
//    O `objectKey` real é cacheado em `app_settings` (key `ghl_movimentacao_object_key`).
// 2. Chamar POST /objects/{objectKey}/records com o payload da movimentação,
//    usando `externalId` = chave_idempotencia para evitar duplicação.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_V2 = "2021-07-28";
const LOCATION_ID = "9iqrKUVPDddINb9S4Iwd";
const OBJECT_LABEL_SINGULAR = "Movimentação Financeira";
const OBJECT_LABEL_PLURAL = "Movimentações Financeiras";
const OBJECT_DESCRIPTION = "Registros rápidos de pagamento recebidos pelo estúdio (sinal, sessão, saldo, produto).";

export interface MovimentacaoSyncPayload {
  id: string;
  chave_idempotencia: string;
  nome_cliente: string;
  data_pagamento: string; // YYYY-MM-DD
  artist_name: string;
  recebido_por_nome: string;
  link_origem: string;
  tipo_movimento: string;
  valor_cartao: number;
  valor_dinheiro: number;
  valor_sumup: number;
  valor_transferencia: number;
  total: number;
  data_tatuagem: string | null;
  observacoes: string | null;
}

export interface MovimentacaoSyncResult {
  ok: boolean;
  ghl_custom_object_id?: string;
  error?: string;
}

function ghlHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Version: GHL_V2,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function ghlFetch(path: string, init: RequestInit, token: string) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    ...init,
    headers: { ...ghlHeaders(token), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

async function getCachedObjectKey(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("app_settings" as never)
    .select("value")
    .eq("key", "ghl_movimentacao_object_key")
    .maybeSingle();
  const value = (data as { value?: { key?: string } } | null)?.value;
  return value?.key ?? null;
}

async function setCachedObjectKey(key: string) {
  await supabaseAdmin.from("app_settings" as never).upsert({
    key: "ghl_movimentacao_object_key",
    value: { key },
    updated_at: new Date().toISOString(),
  } as never);
}

async function findOrCreateObjectKey(token: string): Promise<string> {
  const cached = await getCachedObjectKey();
  if (cached) return cached;

  // 1) tenta descobrir pela listagem de schemas.
  const list = await ghlFetch(
    `/objects/?locationId=${encodeURIComponent(LOCATION_ID)}`,
    { method: "GET" },
    token,
  );
  if (list.ok) {
    const objs = ((list.body as { objects?: Array<{ key?: string; labels?: { singular?: string } }> } | null)?.objects) ?? [];
    const hit = objs.find(
      (o) =>
        typeof o.key === "string" &&
        (o.key.endsWith("movimentacao_financeira") ||
          o.labels?.singular?.toLowerCase().includes("movimenta")),
    );
    if (hit?.key) {
      await setCachedObjectKey(hit.key);
      return hit.key;
    }
  }

  // 2) cria o schema.
  const created = await ghlFetch(
    "/objects/",
    {
      method: "POST",
      body: JSON.stringify({
        locationId: LOCATION_ID,
        labels: { singular: OBJECT_LABEL_SINGULAR, plural: OBJECT_LABEL_PLURAL },
        key: "movimentacao_financeira",
        description: OBJECT_DESCRIPTION,
        primaryDisplayPropertyDetails: {
          key: "nome_cliente",
          name: "Nome do cliente",
          dataType: "TEXT",
        },
      }),
    },
    token,
  );
  if (!created.ok) {
    throw new Error(
      `ghl_object_create_failed status=${created.status} body=${JSON.stringify(created.body).slice(0, 200)}`,
    );
  }
  const key =
    (created.body as { object?: { key?: string } } | null)?.object?.key ??
    "custom_objects.movimentacao_financeira";
  await setCachedObjectKey(key);
  return key;
}

export async function syncMovimentacaoToGhl(
  payload: MovimentacaoSyncPayload,
): Promise<MovimentacaoSyncResult> {
  const token = process.env.GHL_TOKEN;
  if (!token) return { ok: false, error: "GHL_TOKEN ausente" };

  try {
    const objectKey = await findOrCreateObjectKey(token);
    const properties = {
      nome_cliente: payload.nome_cliente,
      data_pagamento: payload.data_pagamento,
      artist_name: payload.artist_name,
      recebido_por: payload.recebido_por_nome,
      link_origem: payload.link_origem,
      tipo_movimento: payload.tipo_movimento,
      valor_cartao: payload.valor_cartao,
      valor_dinheiro: payload.valor_dinheiro,
      valor_sumup: payload.valor_sumup,
      valor_transferencia: payload.valor_transferencia,
      total: payload.total,
      data_tatuagem: payload.data_tatuagem ?? "",
      observacoes: payload.observacoes ?? "",
    };
    const create = await ghlFetch(
      `/objects/${encodeURIComponent(objectKey)}/records`,
      {
        method: "POST",
        body: JSON.stringify({
          locationId: LOCATION_ID,
          externalId: payload.chave_idempotencia,
          properties,
        }),
      },
      token,
    );
    if (!create.ok) {
      return {
        ok: false,
        error: `record_create status=${create.status} body=${JSON.stringify(create.body).slice(0, 200)}`,
      };
    }
    const id =
      (create.body as { record?: { id?: string } } | null)?.record?.id ??
      (create.body as { id?: string } | null)?.id ??
      undefined;
    return { ok: true, ghl_custom_object_id: id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}