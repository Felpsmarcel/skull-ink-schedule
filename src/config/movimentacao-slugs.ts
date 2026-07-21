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