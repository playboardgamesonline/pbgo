import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@pbgo/ui/platform/button"
import { SITE_NAME } from "@/site"

export const siteNotFoundMetadata: Metadata = { title: `Page not found · ${SITE_NAME}`, robots: { index: false, follow: false } }

/**
 * The 404 of the site, in the platform's look. Rendered by `app/global-not-found.tsx` (URLs that match no route) and, for a
 * slug that is not a game, by `app/[game]/not-found.tsx` (through `site-not-found-page.tsx`).
 */
export function SiteNotFound() {
  return (
    <main className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col items-center justify-center gap-4 px-gutter text-center">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="font-heading text-3xl">Page not found</h1>
      <p className="max-w-md text-muted-foreground">This page does not exist, or the game is not here.</p>
      <Button asChild>
        <Link href="/">All games</Link>
      </Button>
    </main>
  )
}
