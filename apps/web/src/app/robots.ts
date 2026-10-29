import type { MetadataRoute } from "next"
import { SITE_URL } from "@/site"

/**
 * robots.txt of playboardgamesonline.app (hub and games). The games' API, the gamemaster, previews and tables are never
 * crawled, nor is `/ingest/`, the analytics proxy, nor the sign-in and the pages of an account (`/login`, `/logout`, `/auth/`, `/me`). The one door left open in `/api/` is `/api/catalog/`, the pictures of the planned
 * games: a game's page names one as its share image, which Facebook, X and the like fetch as crawlers, and which Google may index as an
 * image (the longest rule wins, so it beats `/api/`). Game homes stay crawlable even when not indexable yet: their `noindex` meta keeps
 * them out of results, and a crawler has to fetch the page to read it. So do the hub's game pages (`/game/<slug>`).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/api/catalog/"], disallow: ["/api/", "/ingest/", "/gamemaster", "/login", "/logout", "/auth/", "/me", "/*/preview", "/*/game/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
