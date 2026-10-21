import "server-only"
import type { GameEntry } from "../lib/binding"
import { skinTag } from "../lib/skin-server"
import { sanityClient } from "./client"
import { type SanityImageSource, urlFor } from "./image"

type CoverGame = Pick<GameEntry, "slug" | "sanityProjectId">
type CoverImage = (SanityImageSource & { asset?: { _ref?: string } }) | null

/**
 * Cover art of a game's hub card: the `hero` image ("Character" in the Studio) of the published `interface` document of its Sanity
 * project. null when the game has no project, no image yet or Sanity cannot be reached: the card then shows its neutral placeholder.
 * It shares the skin's cache tag, so saving the Visual section in the gamemaster refreshes the hub too.
 */
export async function gameCover(game: CoverGame, width = 800): Promise<string | null> {
  const client = sanityClient(game)
  if (!client) return null
  try {
    const hero = await client.fetch<CoverImage>(`*[_id == "interface"][0].hero{ asset, crop, hotspot }`, {}, { next: { tags: [skinTag(game.slug)], revalidate: 60 } })
    return hero?.asset?._ref ? urlFor(game, hero).width(width).url() : null
  } catch (error) {
    console.error("Sanity cover unavailable", game.slug, error)
    return null
  }
}
