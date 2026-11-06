import Link from "next/link"
import { ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { DocPage } from "@pbgo/docs"
import { cn } from "@pbgo/ui/utils"

/** One way out of the foot of a page: the page before or the page after, with the word that says which and its title. */
function PagerLink({ page, side }: { page: DocPage; side: "previous" | "next" }) {
  const next = side === "next"
  const arrow = <HugeiconsIcon icon={next ? ArrowRight02Icon : ArrowLeft02Icon} strokeWidth={2} aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
  return (
    <Link
      href={page.href}
      rel={next ? "next" : "prev"}
      className={cn(
        "flex items-center gap-4 rounded-3xl border p-5 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30",
        next && "justify-end text-right sm:col-start-2",
      )}
    >
      {!next && arrow}
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-sm text-muted-foreground">{next ? "Next" : "Previous"}</span>
        <span className="truncate font-heading text-lg">{page.title}</span>
      </span>
      {next && arrow}
    </Link>
  )
}

/**
 * The foot of every page of a doc: the page before and the page after it in the order of the menu, so that a doc split into one page per piece is still read from one end to the other. A page at either end of the doc has only the side it
 * has, the next stays at the right.
 */
export function DocsPager({ previous, next }: { previous: DocPage | null; next: DocPage | null }) {
  if (!previous && !next) return null
  return (
    <nav aria-label="Previous and next page" className="grid gap-4 sm:grid-cols-2">
      {previous && <PagerLink page={previous} side="previous" />}
      {next && <PagerLink page={next} side="next" />}
    </nav>
  )
}
