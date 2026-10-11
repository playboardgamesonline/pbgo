"use client"

import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import "@/app/globals.css"
import { SiteNotFound } from "@/components/site-not-found"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

/**
 * The site's 404 with the hub's styles, fonts and theme, inside the `[game]` layout. Only `game-not-found.tsx` loads it, and
 * lazily: the layout carries none of the hub's CSS, which would clash with the games' own. The font variables sit on a
 * wrapper since `<html>` belongs to the layout.
 */
export default function SiteNotFoundPage() {
  return (
    <div className={cn("font-sans antialiased", GeistSans.variable, GeistMono.variable)}>
      <ThemeProvider>
        <SiteNotFound />
      </ThemeProvider>
    </div>
  )
}
