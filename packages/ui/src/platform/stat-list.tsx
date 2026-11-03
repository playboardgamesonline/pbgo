import * as React from "react"
import { cn } from "../utils"

// Figures and what each counts, for a screen that sums up a visitor or a game, in two shapes of one list of terms (`<dl>`: each figure is a term and its values, so that a screen reader reads "Games played: 24"). The strip is for the head of a page: the figures in a
// row, each under its label, in one container on the platform's glass with a hairline between them, small enough to stand beside the buttons of the head. The column is for a card: one figure to a row, its label and what it adds on the left, the figure, big, on the right, a hairline
// between the rows. A figure is a label, the figure itself (already written: "24", "58%", "—", or a badge) and, in the column only, a word more, quiet ("14 wins"). It draws what it is given and writes no figure itself.

type StatListItem = {
  /** What the figure counts ("Games played"). */
  label: string
  /** The figure, already written. */
  value: React.ReactNode
  /** A word more, quiet ("14 wins"): the column says it, the strip has no room for it. */
  hint?: React.ReactNode
}

type StatListProps = Omit<React.ComponentProps<"dl">, "children"> & {
  items: readonly StatListItem[]
  /** `column` (default): one figure to a row, for a card. `strip`: the figures in a row, for the head of a page. */
  variant?: "column" | "strip"
}

function StatList({ items, variant = "column", className, ...props }: StatListProps) {
  return (
    <dl
      data-slot="stat-list"
      data-variant={variant}
      className={cn(variant === "strip" ? "glass flex divide-x divide-foreground/10 overflow-hidden rounded-xl ring-1 ring-foreground/10" : "flex flex-col divide-y", className)}
      {...props}
    >
      {items.map(({ label, value, hint }) =>
        variant === "strip" ? (
          <div key={label} className="flex min-w-0 flex-col gap-1.5 px-5 py-3">
            <dt className="truncate text-xs text-muted-foreground">{label}</dt>
            <dd className="flex min-h-6 items-center truncate text-lg tabular-nums">{value}</dd>
          </div>
        ) : (
          // The figure comes right after its label in the markup, for a screen reader, and stands at the right of both rows of the grid
          <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-4 first:pt-0 last:pb-0">
            <dt className="col-start-1 truncate text-sm text-muted-foreground">{label}</dt>
            <dd className={cn("col-start-2 row-start-1 font-heading text-3xl tabular-nums", hint && "row-span-2")}>{value}</dd>
            {hint && <dd className="col-start-1 truncate text-sm text-muted-foreground">{hint}</dd>}
          </div>
        )
      )}
    </dl>
  )
}

export { StatList }
export type { StatListItem, StatListProps }
