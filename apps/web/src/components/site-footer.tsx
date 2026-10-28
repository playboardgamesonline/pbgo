import Link from "next/link"
import { ConsentLink } from "@pbgo/analytics/client"
import { Separator } from "@pbgo/ui/platform/separator"
import { Wordmark } from "@pbgo/ui/platform/wordmark"
import { COPYRIGHT_YEAR, SITE_NAME } from "@/site"

/**
 * The footer of the hub's own pages (the home, the list of games, a game's page and the pages of the other tabs): the name of the brand as
 * big letters behind everything (`Wordmark`), then, under a line, the copyright, the links every page owes (cookies, legal notice) and
 * what the site is not (the games belong to their authors and publisher).
 */
export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-page px-gutter pb-10">
      <Wordmark />
      <Separator className="mt-6 mb-6" />
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm text-muted-foreground">
        <p>
          © {COPYRIGHT_YEAR} {SITE_NAME}. All rights reserved.
        </p>
        <div className="flex items-center gap-4">
          {/* Only where analytics are on: it reopens the choice of the cookie banner */}
          <ConsentLink className="cursor-pointer underline-offset-4 hover:underline">Cookies</ConsentLink>
          <Link href="/legal" className="underline-offset-4 hover:underline">
            Legal notice
          </Link>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Unofficial online adaptations. Every game belongs to its authors and publisher.</p>
    </footer>
  )
}
