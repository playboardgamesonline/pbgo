import { createImageUrlBuilder, type SanityImageSource } from "@sanity/image-url"
import type { GameEntry } from "../lib/binding"
import { dataset } from "./env"

export type { SanityImageSource }

type SanityGame = Pick<GameEntry, "sanityProjectId">

const builders = new Map<string, ReturnType<typeof createImageUrlBuilder>>()

function builder(game: SanityGame) {
  let b = builders.get(game.sanityProjectId)
  if (!b) builders.set(game.sanityProjectId, (b = createImageUrlBuilder({ projectId: game.sanityProjectId, dataset })))
  return b
}

/** Image of the game's Sanity project, in the best format the browser accepts (WebP, AVIF…). */
export function urlFor(game: SanityGame, source: SanityImageSource) {
  return builder(game).image(source).auto("format")
}

/** No automatic conversion (share image, favicon): the requested format is served as is, even to browsers that accept WebP. */
export function fixedUrlFor(game: SanityGame, source: SanityImageSource) {
  return builder(game).image(source)
}
