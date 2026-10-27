import type { MetadataRoute } from "next"
import { sitemapItems } from "@pbgo/catalog/seo"
import { getCatalog } from "@pbgo/catalog/server"
import { GAMES } from "@pbgo/games/registry"
import { SITE_URL } from "@/site"

// The planned games come from Notion, which the catalog reads once every ten minutes (`getCatalog`): the sitemap is rebuilt as often,
// not once per build, so a game that gets its description is listed within minutes of the edit
export const revalidate = 600

/**
 * The hub, the home of every indexable game (registry flag `indexable`), then the hub page (`/game/<slug>`) of every game of the catalog
 * that search engines may index: a live game with the flag, a game to come once its Notion row has a description (`isIndexable`).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { entries } = await getCatalog()
  return sitemapItems(SITE_URL, GAMES, entries)
}
