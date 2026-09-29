import { createSitemap } from "@pgo/site"
import { SITE_URL } from "@/lib/site"

export default function sitemap() {
  return createSitemap(SITE_URL)
}
