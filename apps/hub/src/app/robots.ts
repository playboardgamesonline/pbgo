import type { MetadataRoute } from "next"
import { GAMES } from "@/games"
import { SITE_URL } from "@/site"

/** The only robots.txt crawlers read for playboardgamesonline.app: it also covers the game apps served under /<slug>. */
export default function robots(): MetadataRoute.Robots {
  const disallow = GAMES.flatMap((g) => [`/${g.slug}/api/`, `/${g.slug}/admin`, `/${g.slug}/preview`, `/${g.slug}/game/`])
  return {
    rules: [{ userAgent: "*", allow: "/", disallow }],
    sitemap: [`${SITE_URL}/sitemap.xml`, ...GAMES.map((g) => `${SITE_URL}/${g.slug}/sitemap.xml`)],
    host: SITE_URL,
  }
}
