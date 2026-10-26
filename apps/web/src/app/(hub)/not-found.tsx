import type { Metadata } from "next"
import { SiteNotFound, siteNotFoundMetadata } from "@/components/site-not-found"

// The hub layout's title template adds the site name, which `siteNotFoundMetadata` already carries for the layouts that have no template
export const metadata: Metadata = { ...siteNotFoundMetadata, title: "Page not found" }

/**
 * 404 of a hub page that calls `notFound()`: a `/game/<slug>` the catalog does not list. It is the site's 404, drawn inside the
 * hub layout (`global-not-found.tsx` answers the URLs that match no route, `[game]/not-found.tsx` the pages of `/<slug>/...`).
 */
export default function NotFound() {
  return <SiteNotFound />
}
