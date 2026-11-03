import * as React from "react"
import { cn } from "../utils"

// Figures and what each counts, for a thin card that sums up a visitor or a game, in one line, as a list of terms (`<dl>`: each figure is a term and its values, so that a screen reader reads "Games played: 24"). Each figure is under its label, the word more that goes with it beside it, quiet ("38 h played"), a hairline
// between the figures from `lg`; on a narrower screen they stand two to a row. A figure is a label, the figure itself (already written: "24", "58%", "—", or a badge or a few pills) and, when there is one, that word more. It draws what it is given and writes no figure itself.

type StatListItem = {
  /** What the figure counts ("Games played"). */
  label: string
  /** The figure, already written. */
  value: React.ReactNode
  /** A word more, quiet ("14 wins"), beside the figure. */
  hint?: React.ReactNode
}

type StatListProps = Omit<React.ComponentProps<"dl">, "children"> & {
  items: readonly StatListItem[]
}

function StatList({ items, className, ...props }: StatListProps) {
  return (
    <dl data-slot="stat-list" className={cn("grid grid-cols-2 gap-x-6 gap-y-4 lg:flex lg:items-start lg:gap-x-0 lg:divide-x lg:divide-foreground/10", className)} {...props}>
      {items.map(({ label, value, hint }) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5 lg:px-5 lg:first:pl-0 lg:last:pr-0">
          <dt className="truncate text-xs leading-4 text-muted-foreground">{label}</dt>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2">
            <dd className="flex min-h-6 items-center text-base leading-6 tabular-nums">{value}</dd>
            {hint && <dd className="truncate text-sm text-muted-foreground">{hint}</dd>}
          </div>
        </div>
      ))}
    </dl>
  )
}

export { StatList }
export type { StatListItem, StatListProps }
