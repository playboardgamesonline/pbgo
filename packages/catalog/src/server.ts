import "server-only"
import { cache } from "react"
import { GAMES } from "@pbgo/games/registry"
import { buildCatalog, type Catalog } from "./catalog"
import { readSanityGames } from "./sanity"

/** Tag of the cached Sanity read: `revalidateTag(CATALOG_TAG, { expire: 0 })` makes the next read ask Sanity again (a webhook of the project can do that). */
export const CATALOG_TAG = "catalog"
/** How long a Sanity answer is kept before the next read asks again (the stale one is served meanwhile). */
export const CATALOG_REVALIDATE_SECONDS = 600

// What was already logged by this server instance: a page read every few seconds must not repeat one line a thousand times
const reported = new Set<string>()
/** Logs a line of the catalog once per server instance. */
export function reportOnce(message: string) {
  if (reported.has(message)) return
  reported.add(message)
  console.warn(`[catalog] ${message}`)
}

/**
 * The hub catalog: the live games of the registry, then the other games of the platform's Sanity project, each with the values of its
 * game in the Studio (docs/catalog.md). The dataset is public, so nothing is needed to read it. The project is the one optional part:
 * when it does not answer the catalog is the live games alone, each with the little the registry knows of it (`registryRow`: a name,
 * players, a duration, no picture), so a game the site can play is always listed, and a game of the Studio only has no page (in
 * development the other games of the registry are listed too, as "Coming soon", so the hub can be seen whole). Read once per request;
 * the Sanity call itself is cached by Next for `CATALOG_REVALIDATE_SECONDS`.
 */
export const getCatalog = cache(async (): Promise<Catalog> => {
  // When the project cannot be read, a developer's hub also lists the other games of the registry, by name, so that its grid is whole; a deployment never does
  const registryGames = process.env.NODE_ENV === "development"
  try {
    const read = await readSanityGames({ init: { next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_TAG] } } })
    for (const warning of read.warnings) reportOnce(warning)
    for (const game of read.skipped) reportOnce(`The game "${game.name || game.id}" of the Studio is left out: ${game.reason}`)
    return { entries: buildCatalog(GAMES, read.games), source: "ok" }
  } catch (error) {
    reportOnce(`The platform's Sanity project is unavailable, only the live games are listed, from the registry: ${error instanceof Error ? error.message : "unknown error"}`)
    return { entries: buildCatalog(GAMES, [], { registryGames }), source: "unavailable" }
  }
})
