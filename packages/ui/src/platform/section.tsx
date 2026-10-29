import * as React from "react"
import { Slot } from "radix-ui"
import { cn } from "../utils"
import { buttonVariants } from "./button"

// A block of a hub page: what it shows, and the way to the page of its tab. The home is a stack of them (popular games, tables and tournaments in
// progress, what's new). They carry no visible title: what they show says what they are (the cards of games, the rows of tables), and a
// screen reader gets an `sr-only` heading. They are as wide as the window between their `px-gutter` margins (64px on a desktop), with no `max-w-page`, so the
// cards of a list fill a desktop screen, and keep `pb-section` between them.

/** The block itself: name it with `aria-labelledby`, pointing at an `sr-only` heading, or with an `aria-label`. */
function Section({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="section"
      className={cn("flex w-full flex-col gap-4 px-gutter pb-section", className)}
      {...props}
    />
  )
}

/**
 * The way to the page the section is a preview of ("See all games"): a link as a button, bigger than a control of a page (`h-12`, `text-base`) since
 * it is the one thing a visitor is asked to do there. It is the framework's link through `asChild` (`@pbgo/ui` is framework-free). Over a
 * `SectionPreview` it sits on the fade; on its own, under an empty state, it is centred by the section.
 */
function SectionAction({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"a"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "a"
  return (
    <Comp
      data-slot="section-action"
      className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "h-12 px-6 text-base shadow-float", className)}
      {...props}
    />
  )
}

/**
 * A preview of a longer list: what it holds (`children`: a grid of cards, a list of rows) fades out at the bottom, and `action` sits over the
 * fade, centred, the way to the rest. The fade is a mask on the content alone (opacity, no colour of the page in it), so the section may sit
 * on any backdrop and the button stays sharp.
 */
function SectionPreview({
  action,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  /** What sits over the fade: a `SectionAction`. */
  action: React.ReactNode
}) {
  return (
    <div data-slot="section-preview" className={cn("relative", className)} {...props}>
      <div data-slot="section-preview-content" className="mask-b-from-60%">
        {children}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex justify-center">{action}</div>
    </div>
  )
}

export { Section, SectionAction, SectionPreview }
