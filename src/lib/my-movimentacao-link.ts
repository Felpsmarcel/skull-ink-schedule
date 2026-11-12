import {
  MOVIMENTACAO_PROD_ORIGIN,
  MOVIMENTACAO_SLUGS,
  type MovimentacaoSlug,
} from "@/config/movimentacao-slugs";

export interface MySlugIdentity {
  role: string | null;
  artist_id: string | null;
  seller_id: string | null;
}

export type MySlugResult =
  | { slug: MovimentacaoSlug; displayName: string }
  | { slug: null; reason: "no_link" };

/** A role grants no personal link. Only its explicitly associated identity can. */
export function resolveMyMovimentacaoLink(identity: MySlugIdentity): MySlugResult {
  const { role, artist_id, seller_id } = identity;
  if (role !== "admin" && role !== "artist" && role !== "seller") {
    return { slug: null, reason: "no_link" };
  }

  const matches = Object.values(MOVIMENTACAO_SLUGS).filter((target) =>
    target.kind === "artist"
      ? (role === "admin" || role === "artist") && target.artistId === artist_id
      : (role === "admin" || role === "seller") && target.sellerId === seller_id,
  );
  // Conflicting associations need an explicit choice, not a silent first match.
  if (matches.length !== 1) return { slug: null, reason: "no_link" };
  const target = matches[0];
  return { slug: target.slug, displayName: target.displayName };
}

export interface MovimentacaoLinkAddress {
  url: string;
  isTest: boolean;
}

/** Keep preview/local navigation in its own origin; never redirect it to production. */
export function getMovimentacaoLinkAddress(
  slug: MovimentacaoSlug,
  currentOrigin: string | null,
): MovimentacaoLinkAddress | null {
  if (!currentOrigin) return null;
  try {
    const parsed = new URL(currentOrigin);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const isTest =
      parsed.origin !== MOVIMENTACAO_PROD_ORIGIN &&
      parsed.origin !== "https://www.gftattoocalendar.com";
    return { url: `${parsed.origin}/movimentacao/${slug}`, isTest };
  } catch {
    return null;
  }
}
