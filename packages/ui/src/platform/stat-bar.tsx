import * as React from "react"
import { cn } from "../utils"

// A row of figures for the top of a page's content, each in a card of its own: a block for each figure (`StatBarItem`), on the surface that the platform's cards have (`bg-card`, the surfaces' radius, a ring and their shadow), a little apart from the next (1rem; the
// columns are the page's to give, `grid-cols-*` in `className`). A block keeps 1.5rem from the edge of its card on every side, so that nothing meets the curve, and is a label in small capitals at its top and, at its foot, whatever it has to say. There is at least 1rem between the
// label and what the block says: in a row the labels stand on one line and what each says ends on one line, whatever its height, so that a block with less to say has more air under its label. It draws what it is given and writes no figure itself: the figure is a
// `StatBarValue`, what goes under it a `StatBarNote`.

function StatBar({ className, ...props }: React.ComponentProps<"section">) {
  return <section data-slot="stat-bar" className={cn("grid gap-4", className)} {...props} />
}

type StatBarItemProps = React.ComponentProps<"div"> & {
  /** What the block counts ("Play time"): it is written in capitals by the style, not by the text. */
  label: string
}

function StatBarItem({ label, className, children, ...props }: StatBarItemProps) {
  return (
    <div
      data-slot="stat-bar-item"
      className={cn("flex min-w-0 flex-col justify-between gap-4 rounded-4xl bg-card p-6 text-card-foreground shadow-surface ring-1 ring-foreground/10", className)}
      {...props}
    >
      <StatBarLabel>{label}</StatBarLabel>
      <div data-slot="stat-bar-content" className="flex min-w-0 flex-col gap-2">
        {children}
      </div>
    </div>
  )
}

/** A label in small capitals, written in sentence case ("Play time"): the style makes the capitals. The label of a block, and any other that a block has under its figure. */
function StatBarLabel({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="stat-bar-label" className={cn("text-xs leading-4 tracking-wider text-muted-foreground uppercase", className)} {...props} />
}

/** The figure of a block: the heading font at 1.25rem, in tabular figures so that it does not shift as it changes. */
function StatBarValue({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="stat-bar-value" className={cn("font-heading text-xl leading-7 tabular-nums", className)} {...props} />
}

/** What a block says under its figure: small and quiet. */
function StatBarNote({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="stat-bar-note" className={cn("text-xs leading-4 text-muted-foreground", className)} {...props} />
}

export { StatBar, StatBarItem, StatBarLabel, StatBarNote, StatBarValue }
export type { StatBarItemProps }
