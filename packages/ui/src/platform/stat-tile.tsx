import * as React from "react"
import { cn } from "../utils"

// One figure and what it counts, for a screen that sums up a visitor or a game (the stats of a game's page): the label, quiet, then the figure, big, then a word more when there is one. It is no card: no outline and no fill, the figure (`text-5xl`)
// and the room around it are what make it stand out, and the figures of a row stand in a line. The tiles of a row go in a list of terms (`<dl>`): each is a term and its values, so that a screen reader reads "Games played: 24". It draws what it
// is given, and writes no figure itself.

type StatTileProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** What the figure counts ("Games played"). */
  label: string
  /** The figure, already written: "24", "58%", "—" when there is none. */
  value: React.ReactNode
  /** A word more, quiet ("14 wins", "Best 1502"). */
  hint?: React.ReactNode
}

function StatTile({ className, label, value, hint, ...props }: StatTileProps) {
  return (
    <div data-slot="stat-tile" className={cn("flex min-w-0 flex-col gap-2", className)} {...props}>
      <dt className="truncate text-sm text-muted-foreground">{label}</dt>
      <dd className="truncate font-heading text-5xl tabular-nums">{value}</dd>
      {hint && <dd className="truncate text-sm text-muted-foreground">{hint}</dd>}
    </div>
  )
}

export { StatTile }
export type { StatTileProps }
