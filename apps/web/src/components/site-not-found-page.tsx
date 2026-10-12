"use client"

import "@/app/globals.css"
import { SiteNotFound } from "@/components/site-not-found"

/**
 * The site's 404 with the hub's styles and the platform theme, inside the `[game]` layout. Only `game-not-found.tsx` loads
 * it, and lazily: the layout carries none of the hub's CSS, which would clash with the games' own. The `platform` class
 * sits on a wrapper since `<html>` belongs to the layout.
 */
export default function SiteNotFoundPage() {
  return (
    <div className="platform bg-background">
      <SiteNotFound />
    </div>
  )
}
