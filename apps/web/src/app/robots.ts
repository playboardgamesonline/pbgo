import type { MetadataRoute } from "next"
import { SITE_URL } from "@/site"

/**
 * robots.txt of playboardgamesonline.app (hub and games). The games' API, the gamemaster, previews and tables are never
 * crawled, nor is `/ingest/`, the analytics proxy, nor the sign-in and the pages of an account (`/login`, `/logout`, `/auth/`, `/me`). The one door left open in `/api/` is `/api/catalog/`, the icons of the games and of
 * their publishers, and the old addresses of the games' pictures, which now lead to the image CDN of the platform's Sanity project: the
 * share image of a game's page used to be one of them, and Facebook, X and the like keep the links they have seen and fetch them as
 * crawlers (the longest rule wins, so it beats `/api/`). Game homes stay crawlable even when not indexable yet: their `noindex` meta keeps
 * them out of results, and a crawler has to fetch the page to read it. So do the hub's game pages (`/game/<slug>`).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/api/catalog/"], disallow: ["/api/", "/ingest/", "/gamemaster", "/login", "/logout", "/auth/", "/me", "/*/preview", "/*/game/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
