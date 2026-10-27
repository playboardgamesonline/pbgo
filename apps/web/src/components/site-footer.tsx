import Link from "next/link"
import { ConsentLink } from "@pbgo/analytics/client"
import { Separator } from "@pbgo/ui/platform/separator"

/** The footer of the hub's own pages (the list of games and a game's page). */
export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-page px-gutter pb-10">
      <Separator className="mb-6" />
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>Unofficial online adaptations. Every game belongs to its authors and publisher.</p>
        <div className="flex items-center gap-4">
          {/* Only where analytics are on: it reopens the choice of the cookie banner */}
          <ConsentLink className="cursor-pointer underline-offset-4 hover:underline">Cookies</ConsentLink>
          <Link href="/legal" className="underline-offset-4 hover:underline">
            Legal notice
          </Link>
        </div>
      </div>
    </footer>
  )
}
