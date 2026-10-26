import { HugeiconsIcon } from "@hugeicons/react"
import { DiceIcon } from "@hugeicons/core-free-icons"
import Link from "next/link"
import { Button } from "@pbgo/ui/platform/button"
import { SITE_NAME } from "@/site"

/** The sticky header of the hub's own pages (the list of games and a game's page): the site's name, and the way back to the games. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-page items-center justify-between px-gutter">
        <Link href="/" className="flex items-center gap-2">
          <HugeiconsIcon icon={DiceIcon} strokeWidth={2} className="size-5" />
          {SITE_NAME}
        </Link>
        <Button variant="ghost" asChild>
          <Link href="/#games">Games</Link>
        </Button>
      </div>
    </header>
  )
}
