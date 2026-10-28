import "server-only"
import { cache } from "react"
import { GAMES } from "@pbgo/games/registry"
import { buildCatalog, type Catalog } from "./catalog"
import { readNotionGames } from "./notion"

/** Tag of the cached Notion calls: `revalidateTag(CATALOG_TAG, { expire: 0 })` makes the next read ask Notion again. */
export const CATALOG_TAG = "catalog"
/** How long a Notion answer is kept before the next read asks again (the stale one is served meanwhile). */
export const CATALOG_REVALIDATE_SECONDS = 600

// What was already logged by this server instance: a page read every few seconds must not repeat one line a thousand times
const reported = new Set<string>()
/** Logs a line of the catalog once per server instance. */
export function reportOnce(message: string) {
  if (reported.has(message)) return
  reported.add(message)
  console.warn(`[catalog] ${message}`)
}

/** The Notion integration token, or undefined when the server has none (the catalog is then the live games alone, from the registry). */
export function notionToken(): string | undefined {
  return process.env.NOTION_API_KEY?.trim() || undefined
}

/**
 * The hub catalog: the live games of the registry, then the other games of Notion, each with the values of its Notion row
 * (`NOTION_API_KEY`, see docs/catalog.md). Notion is the one optional part: without the key, or when Notion does not answer, the
 * catalog is the live games alone, each with the little the registry knows of it (`registryRow`: a name, players, a duration, no
 * picture), so a game the site can play is always listed, and a Notion-only game has no page (in development the other games of the registry
 * are listed too, as "Coming soon", so the hub can be seen whole). Read once per request; the Notion
 * calls themselves are cached by Next for `CATALOG_REVALIDATE_SECONDS`.
 */
export const getCatalog = cache(async (): Promise<Catalog> => {
  // With no Notion, a developer's hub also lists the other games of the registry, by name, so that its grid is whole; a deployment never does
  const registryGames = process.env.NODE_ENV === "development"
  const token = notionToken()
  if (!token) return { entries: buildCatalog(GAMES, [], { registryGames }), notion: "off" }
  try {
    const read = await readNotionGames({ token, init: { next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_TAG] } } })
    for (const warning of read.warnings) reportOnce(warning)
    for (const row of read.skipped) reportOnce(`The Notion row "${row.name || row.id}" is left out: ${row.reason}`)
    return { entries: buildCatalog(GAMES, read.games), notion: "ok" }
  } catch (error) {
    reportOnce(`Notion is unavailable, only the live games are listed, from the registry: ${error instanceof Error ? error.message : "unknown error"}`)
    return { entries: buildCatalog(GAMES, [], { registryGames }), notion: "unavailable" }
  }
})
