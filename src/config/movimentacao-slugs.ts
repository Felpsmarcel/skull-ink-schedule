// Slug → identidade para links individuais de registro de pagamento.
// IDs vindos do banco (verificados em 2026-07). Se um artista mudar, atualizar aqui.

export type MovimentacaoSlug = "gabriel" | "andre" | "joyce" | "augusto" | "nivia";

export interface SlugTargetArtist {
  slug: Exclude<MovimentacaoSlug, "nivia">;
  kind: "artist";
  artistId: string;
  displayName: string;
}

export interface SlugTargetSeller {
  slug: "nivia";
  kind: "seller";
  sellerId: string;
  displayName: string;
}

export type SlugTarget = SlugTargetArtist | SlugTargetSeller;

export const MOVIMENTACAO_SLUGS: Record<MovimentacaoSlug, SlugTarget> = {
  gabriel: {
    slug: "gabriel",
    kind: "artist",
    artistId: "8e2c168e-eecf-42d9-9b80-da09fb4479ba",
    displayName: "Gabriel Fernandes",
  },
  andre: {
    slug: "andre",
    kind: "artist",
    artistId: "8489abdc-3a9a-4114-85a1-a4947da979df",
    displayName: "Andre Pareyn",
  },
  joyce: {
    slug: "joyce",
    kind: "artist",
    artistId: "a6f68d5d-5e4b-4309-86f0-01cc5a5cce10",
    displayName: "Joyce Cavalcante",
  },
  augusto: {
    slug: "augusto",
    kind: "artist",
    artistId: "99923ac0-7976-45dd-b19a-0b160af0c831",
    displayName: "Augusto",
  },
  nivia: {
    slug: "nivia",
    kind: "seller",
    sellerId: "cce99d65-1e2d-4bf6-9cc7-292b95ea8705",
    displayName: "Nivia",
  },
};

export const MOVIMENTACAO_SLUG_LIST: MovimentacaoSlug[] = [
  "gabriel",
  "andre",
  "joyce",
  "augusto",
  "nivia",
];

export function isMovimentacaoSlug(v: string): v is MovimentacaoSlug {
  return (MOVIMENTACAO_SLUG_LIST as string[]).includes(v);
}

// Origem pública canônica usada para montar os links de registro de pagamento.
export const MOVIMENTACAO_PROD_ORIGIN = "https://gftattoocalendar.com";

export function findSlugForSeller(sellerId: string): MovimentacaoSlug | null {
  for (const key of MOVIMENTACAO_SLUG_LIST) {
    const t = MOVIMENTACAO_SLUGS[key];
    if (t.kind === "seller" && t.sellerId === sellerId) return t.slug;
  }
  return null;
}

// ---------- Staff que pode receber pagamento --------------------------------
// Lista fechada usada no seletor "Recebido por" do formulário público.
// appUserId aponta para app_users(id) real — validado no banco em 2026-07.

export type StaffRecebedorId = "gabriel" | "nivia" | "augusto";

export interface StaffRecebedor {
  id: StaffRecebedorId;
  displayName: string;
  appUserId: string;
}

export const STAFF_RECEBEDORES: StaffRecebedor[] = [
  { id: "gabriel", displayName: "Gabriel", appUserId: "7cf2055b-0ee6-4dc9-95aa-6ec7b6b491a8" },
  { id: "nivia",   displayName: "Nivia",   appUserId: "ac83fbba-ea45-4e26-ba1a-0a0020fc0e3e" },
  { id: "augusto", displayName: "Augusto", appUserId: "952d9a08-873e-46d5-a2f2-c3b7800f72b9" },
];

export const STAFF_RECEBEDOR_IDS: [StaffRecebedorId, ...StaffRecebedorId[]] = [
  "gabriel",
  "nivia",
  "augusto",
];

export function getStaffRecebedor(id: StaffRecebedorId): StaffRecebedor {
  const hit = STAFF_RECEBEDORES.find((s) => s.id === id);
  if (!hit) throw new Error(`Recebedor inválido: ${id}`);
  return hit;
}

// Slug → recebedor default (editável no formulário).
export const SLUG_DEFAULT_RECEBEDOR: Record<MovimentacaoSlug, StaffRecebedorId> = {
  gabriel: "gabriel",
  andre: "gabriel",
  joyce: "gabriel",
  augusto: "augusto",
  nivia: "nivia",
};