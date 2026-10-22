import "server-only"
import type { SanityClient } from "@sanity/client"
import { CATALOG_QUERY } from "./queries"
import type { CATALOG_QUERY_RESULT } from "./types"

/**
 * Flip 7 content of the game's Sanity project (the pictures of the cards, the table and the back of a card, the words of the board),
 * cached 60 s. The result type is imported explicitly: `types.ts` (studio typegen) is then part of every program, apps/web's included.
 */
export async function getCatalog(sanity: SanityClient | null): Promise<CATALOG_QUERY_RESULT> {
  if (!sanity) throw new Error("Sanity is not configured")
  return sanity.fetch(CATALOG_QUERY, {}, { next: { revalidate: 60, tags: ["flip-7:catalog"] } })
}
