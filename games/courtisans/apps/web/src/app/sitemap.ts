import { createSitemap } from "@pbgo/site"
import { INDEXABLE, GAME_URL } from "@/lib/site"

export default function sitemap() {
  return createSitemap(GAME_URL, INDEXABLE)
}
