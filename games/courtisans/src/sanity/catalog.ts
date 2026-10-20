import "server-only"
import type { SanityClient } from "@sanity/client"
import { CATALOG_QUERY } from "./queries"
import type { CATALOG_QUERY_RESULT } from "./types"

/**
 * Courtisans content of the game's Sanity project (cards, families, roles, missions), cached 60 s.
 * The result type is imported explicitly: `types.ts` (studio typegen) is then part of every program, apps/web's included.
 */
export async function getCatalog(sanity: SanityClient | null): Promise<CATALOG_QUERY_RESULT> {
  if (!sanity) throw new Error("Sanity is not configured")
  return sanity.fetch(CATALOG_QUERY, {}, { next: { revalidate: 60, tags: ["courtisans:catalog"] } })
}
