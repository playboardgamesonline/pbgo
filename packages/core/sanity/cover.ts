import "server-only"
import type { GameEntry } from "../lib/binding"
import { settingsTag } from "../lib/settings-server"
import { skinTag } from "../lib/skin-server"
import { sanityClient } from "./client"
import { type SanityImageSource, urlFor } from "./image"

type CoverGame = Pick<GameEntry, "slug" | "sanityProjectId">
type CoverImage = (SanityImageSource & { asset?: { _ref?: string } }) | null | undefined

/** The pictures of a live game's card and page on the hub, as URLs; null for one the game does not have. */
export type CardArt = { logo: string | null; background: string | null }

const imageUrl = (game: CoverGame, image: CoverImage, width: number) => (image?.asset?._ref ? urlFor(game, image).width(width).url() : null)

/**
 * The `hero` image ("Character" in the Studio) of the published `interface` document of a game's Sanity project, null when the game
 * has no project, no image yet or Sanity cannot be reached. The hub's cards and the pages of the games no longer draw it (they draw
 * the two pictures of `gameCardArt()`); `/design` borrows it as a stand-in background. It shares the skin's cache tag, so saving the
 * Visual section in the gamemaster refreshes it too.
 */
export async function gameCover(game: CoverGame, width = 800): Promise<string | null> {
  const client = sanityClient(game)
  if (!client) return null
  try {
    const hero = await client.fetch<CoverImage>(`*[_id == "interface"][0].hero{ asset, crop, hotspot }`, {}, { next: { tags: [skinTag(game.slug)], revalidate: 60 } })
    return imageUrl(game, hero, width)
  } catch (error) {
    console.error("Sanity cover unavailable", game.slug, error)
    return null
  }
}

/**
 * Art of a live game on the hub, for its card and for its page, read in one request from its Sanity project: the `logo` of the published
 * `settings` document and the `background` ("Background" of the Studio's Visual section) of the published `interface` one. Each is null
 * when the game has none yet; both are, when it has no project or Sanity cannot be reached, and the picture then shows its plain frame.
 * It shares the cache tags of the settings and of the skin, so saving either section in the gamemaster refreshes the hub too.
 */
export async function gameCardArt(game: CoverGame, width = 800): Promise<CardArt> {
  const client = sanityClient(game)
  if (!client) return { logo: null, background: null }
  try {
    const art = await client.fetch<{ logo?: CoverImage; background?: CoverImage } | null>(
      `{ "logo": *[_id == "settings"][0].logo{ asset, crop, hotspot }, "background": *[_id == "interface"][0].background{ asset, crop, hotspot } }`,
      {},
      { next: { tags: [settingsTag(game.slug), skinTag(game.slug)], revalidate: 60 } }
    )
    return { logo: imageUrl(game, art?.logo, width), background: imageUrl(game, art?.background, width) }
  } catch (error) {
    console.error("Sanity card art unavailable", game.slug, error)
    return { logo: null, background: null }
  }
}
