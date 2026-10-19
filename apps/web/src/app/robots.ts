import type { MetadataRoute } from "next"
import { SITE_URL } from "@/site"

/**
 * robots.txt of playboardgamesonline.app (hub and games). The games' API, the gamemaster, previews and tables are never
 * crawled, nor is `/ingest/`, the analytics proxy. Game homes stay crawlable even when not indexable yet: their `noindex` meta
 * keeps them out of results, and a crawler has to fetch the page to read it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/ingest/", "/gamemaster", "/*/preview", "/*/game/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
