import * as React from "react"
import { cn } from "../utils"

// Figures and what each counts, for a screen that sums up a visitor or a game, in two shapes of one list of terms (`<dl>`: each figure is a term and its values, so that a screen reader reads "Games played: 24"). The strip is for the head of a page: the figures in a row, each under its label, in one
// container on the platform's glass with a hairline between them, as tall as the buttons that it stands beside (3rem, the `xl` size). The bar is for a thin card: the figures in one line, each under its label with the word more beside it, a hairline between them from `lg`, two to a row before. A figure
// is a label, the figure itself (already written: "24", "58%", "—", or a badge) and, in the bar, a word more, quiet ("14 wins"), which the strip has no room for. It draws what it is given and writes no figure itself.

type StatListItem = {
  /** What the figure counts ("Games played"). */
  label: string
  /** The figure, already written. */
  value: React.ReactNode
  /** A word more, quiet ("14 wins"): the bar says it, the strip has no room for it. */
  hint?: React.ReactNode
}

type StatListProps = Omit<React.ComponentProps<"dl">, "children"> & {
  items: readonly StatListItem[]
  /** `bar` (default): all in one line, for a thin card. `strip`: the figures in a row as tall as a button, for the head of a page. */
  variant?: "bar" | "strip"
}

const SHAPES = {
  strip: "glass flex h-12 divide-x divide-foreground/10 overflow-hidden rounded-xl ring-1 ring-foreground/10",
  bar: "grid grid-cols-2 gap-x-6 gap-y-4 lg:flex lg:items-start lg:gap-x-0 lg:divide-x lg:divide-foreground/10",
}

function StatList({ items, variant = "bar", className, ...props }: StatListProps) {
  return (
    <dl data-slot="stat-list" data-variant={variant} className={cn(SHAPES[variant], className)} {...props}>
      {items.map(({ label, value, hint }) =>
        variant === "strip" ? (
          <div key={label} className="flex min-w-0 flex-col justify-center px-5">
            <dt className="truncate text-xs leading-4 text-muted-foreground">{label}</dt>
            <dd className="flex h-6 items-center truncate text-base leading-6 tabular-nums">{value}</dd>
          </div>
        ) : (
          <div key={label} className="flex min-w-0 flex-col gap-0.5 lg:px-5 lg:first:pl-0 lg:last:pr-0">
            <dt className="truncate text-xs leading-4 text-muted-foreground">{label}</dt>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2">
              <dd className="flex min-h-6 items-center text-base leading-6 tabular-nums">{value}</dd>
              {hint && <dd className="truncate text-sm text-muted-foreground">{hint}</dd>}
            </div>
          </div>
        )
      )}
    </dl>
  )
}

export { StatList }
export type { StatListItem, StatListProps }
