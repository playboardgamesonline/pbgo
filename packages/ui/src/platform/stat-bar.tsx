import * as React from "react"
import { cn } from "../utils"

// A bar of figures for the top of a page's content, on a surface of its own: a cell for each figure (`StatBarItem`), cut from the next by a hairline wherever two sit side by side or one over the other, at whatever number of columns the bar has at that width (the hairline is the bar's
// colour showing through a 1px gap, so it is never doubled and never missing at the end of a row). It is the surfaces' radius (`rounded-4xl`) and the cells keep 1.5rem from its edge on every side, so that nothing meets the curve. The columns are the page's to give (`grid-cols-*` in `className`). A cell is a label in small
// capitals at its top, with a control at its right end when it has one (a button that leads to more, level with the label), and, at its foot, whatever it has to say, with a place before them for a picture (an emblem, a medal). There is at least 1rem between the label and what the cell says: in a row the labels stand on one line and what each says ends on one line, whatever its height, so that a cell with
// less to say has more air under its label. It draws what it is given and writes no figure itself: the figure is a `StatBarValue`, what goes under it a `StatBarNote`.

function StatBar({ className, ...props }: React.ComponentProps<"section">) {
  return <section data-slot="stat-bar" className={cn("grid gap-px overflow-hidden rounded-4xl bg-foreground/10 text-card-foreground shadow-surface ring-1 ring-foreground/10", className)} {...props} />
}

type StatBarItemProps = React.ComponentProps<"div"> & {
  /** What the cell counts ("Play time"): it is written in capitals by the style, not by the text. */
  label: string
  /** A picture before the text: an emblem, a medal. */
  visual?: React.ReactNode
  /** A control at the right end of the label's row, level with the label: a button that leads to more. It takes no height of its own, the row stays as tall as the label. */
  action?: React.ReactNode
  /** The classes of the block that holds what the cell says, to change the room between its parts (`gap-2`). */
  contentClassName?: string
}

function StatBarItem({ label, visual, action, className, contentClassName, children, ...props }: StatBarItemProps) {
  return (
    <div data-slot="stat-bar-item" className={cn("flex min-w-0 items-center gap-4 bg-card p-6", className)} {...props}>
      {visual}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 self-stretch">
        <div className="flex items-center justify-between gap-3">
          <StatBarLabel>{label}</StatBarLabel>
          {action && <div className="-my-2 shrink-0">{action}</div>}
        </div>
        <div data-slot="stat-bar-content" className={cn("flex min-w-0 flex-col gap-2", contentClassName)}>
          {children}
        </div>
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
