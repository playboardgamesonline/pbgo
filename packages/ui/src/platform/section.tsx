import * as React from "react"
import { Slot } from "radix-ui"
import { cn } from "../utils"
import { buttonVariants } from "./button"

// A section of a hub page: a heading with its "See all" on one line, then what it holds. The home is a stack of them (popular games, tables and
// tournaments in progress, what's new), each leading to the page of its tab. They are as wide as the page (`max-w-page`, the `px-gutter` margins)
// and keep `pb-section` between them.

/** The section itself: name it with `aria-labelledby`, pointing at its `SectionTitle`. */
function Section({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="section"
      className={cn("mx-auto flex w-full max-w-page flex-col gap-4 px-gutter pb-section", className)}
      {...props}
    />
  )
}

/** The line above the content: the title on the left, the action on the right. */
function SectionHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="section-header" className={cn("flex items-center justify-between gap-4", className)} {...props} />
}

function SectionTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 data-slot="section-title" className={cn("font-heading text-2xl", className)} {...props} />
}

/**
 * The way to the page the section is a preview of ("See all"): a small outline button that is a link, or the framework's through `asChild`
 * (`@pbgo/ui` is framework-free). Put an arrow icon in it if the page wants one.
 */
function SectionAction({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a"
  return <Comp data-slot="section-action" className={cn(buttonVariants({ variant: "outline", size: "sm" }), className)} {...props} />
}

/**
 * A row of cards that scrolls sideways, for a preview that has more to show than a section has room for. Each child is a card of the same
 * width (`w-64`, `sm:w-72`) that the row snaps to. The row runs out to the edges of the section (it takes back the `px-gutter` it sits in), so
 * the cards scroll under the margins instead of being cut at the content, and the first one still lines up with the title. Name it with an
 * `aria-label`: its cards are links, so the keyboard reaches them and the row follows.
 */
function SectionRail({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="section-rail"
      role="group"
      className={cn(
        "-mx-gutter flex snap-x snap-mandatory scroll-px-gutter gap-4 overflow-x-auto px-gutter pb-2 [&>*]:w-64 [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-72",
        className
      )}
      {...props}
    />
  )
}

export { Section, SectionHeader, SectionTitle, SectionAction, SectionRail }
