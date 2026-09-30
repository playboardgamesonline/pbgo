import { createSitemap } from "@pbgo/site"
import { SITE_URL } from "@/lib/site"

export default function sitemap() {
  return createSitemap(SITE_URL)
}
