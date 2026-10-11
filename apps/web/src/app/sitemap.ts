import type { MetadataRoute } from "next"
import { gameUrl } from "@pbgo/core/lib/site-url"
import { GAMES } from "@pbgo/games/registry"
import { SITE_URL } from "@/site"

/** The hub and the home of every indexable game (registry flag `indexable`). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...GAMES.filter((game) => game.indexable).map((game) => ({ url: gameUrl(game.slug), changeFrequency: "weekly" as const, priority: 0.9 })),
  ]
}
