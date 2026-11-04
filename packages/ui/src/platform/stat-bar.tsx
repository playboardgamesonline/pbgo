import * as React from "react"
import { cn } from "../utils"

// A bar of figures for the top of a page's content, on a surface of its own: a cell for each figure (`StatBarItem`), cut from the next by a hairline wherever two sit side by side or one over the other, at whatever number of columns the bar has at that width (the hairline is the bar's
// colour showing through a 1px gap, so it is never doubled and never missing at the end of a row). It is the surfaces' radius (`rounded-4xl`) and the cells keep 1.5rem from its edge, so that nothing meets the curve. The columns are the page's to give (`grid-cols-*` in `className`). A cell is a label in small
// capitals over what it says (the labels of the cells of a row stand on one line, 0.75rem over what each says), with a place before it for a picture (an emblem, a medal), and under it whatever the cell has to say, a button included. It draws what it is given and writes no figure itself: the figure is a `StatBarValue`, what goes under it a `StatBarNote`.

function StatBar({ className, ...props }: React.ComponentProps<"section">) {
  return <section data-slot="stat-bar" className={cn("grid gap-px overflow-hidden rounded-4xl bg-foreground/10 text-card-foreground shadow-surface ring-1 ring-foreground/10", className)} {...props} />
}

type StatBarItemProps = React.ComponentProps<"div"> & {
  /** What the cell counts ("Play time"): it is written in capitals by the style, not by the text. */
  label: string
  /** A picture before the text: an emblem, a medal. */
  visual?: React.ReactNode
}

function StatBarItem({ label, visual, className, children, ...props }: StatBarItemProps) {
  return (
    <div data-slot="stat-bar-item" className={cn("flex min-w-0 items-center gap-4 bg-card px-6 py-5", className)} {...props}>
      {visual}
      <div className="flex min-w-0 flex-1 flex-col gap-2 self-stretch">
        <StatBarLabel className="mb-1">{label}</StatBarLabel>
        {children}
      </div>
    </div>
  )
}

/** A label in small capitals, written in sentence case ("Play time"): the style makes the capitals. The label of a cell, and any other that a cell has under its figure. */
function StatBarLabel({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="stat-bar-label" className={cn("text-xs leading-4 tracking-wider text-muted-foreground uppercase", className)} {...props} />
}

/** The figure of a cell: the heading font at 1.25rem, in tabular figures so that it does not shift as it changes. */
function StatBarValue({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="stat-bar-value" className={cn("font-heading text-xl leading-7 tabular-nums", className)} {...props} />
}

/** What a cell says under its figure: small and quiet. */
function StatBarNote({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="stat-bar-note" className={cn("text-xs leading-4 text-muted-foreground", className)} {...props} />
}

export { StatBar, StatBarItem, StatBarLabel, StatBarNote, StatBarValue }
export type { StatBarItemProps }
