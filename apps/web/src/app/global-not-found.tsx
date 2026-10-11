import type { Metadata } from "next"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import "./globals.css"
import { SiteNotFound, siteNotFoundMetadata } from "@/components/site-not-found"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

export const metadata: Metadata = siteNotFoundMetadata

/**
 * 404 of the whole site (`experimental.globalNotFound`): the hub and the games have separate root layouts, so there is
 * no shared layout to render a not-found page in. The router renders it for every URL that matches no route (a path
 * under `/<slug>/` that is not a game page, for instance). A page that calls `notFound()` is answered by the
 * `not-found.tsx` of its segment instead: `[game]/not-found.tsx`, which shows this same page for a slug that is not a game.
 */
export default function GlobalNotFound() {
  return (
    <html lang="en" suppressHydrationWarning className={cn("antialiased", GeistSans.variable, GeistMono.variable, "font-sans")}>
      <body>
        <ThemeProvider>
          <SiteNotFound />
        </ThemeProvider>
      </body>
    </html>
  )
}
