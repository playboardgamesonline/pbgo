import type { Metadata, Viewport } from "next"
import { AnalyticsProvider } from "@pbgo/analytics/client"
import { PLATFORM_THEME_COLOR } from "@pbgo/ui/theme"
import "./globals.css"
import { PlatformDocument } from "@/components/platform-document"
import { SiteNotFound, siteNotFoundMetadata } from "@/components/site-not-found"

export const metadata: Metadata = siteNotFoundMetadata

export const viewport: Viewport = { themeColor: PLATFORM_THEME_COLOR, colorScheme: "dark" }

/**
 * 404 of the whole site (`experimental.globalNotFound`): the hub and the games have separate root layouts, so there is
 * no shared layout to render a not-found page in. The router renders it for every URL that matches no route (a path
 * under `/<slug>/` that is not a game page, for instance). A page that calls `notFound()` is answered by the
 * `not-found.tsx` of its segment instead: `[game]/not-found.tsx`, which shows this same page for a slug that is not a game.
 */
export default function GlobalNotFound() {
  return (
    <PlatformDocument>
      <SiteNotFound />
      <AnalyticsProvider />
    </PlatformDocument>
  )
}
