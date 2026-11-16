import * as React from "react"
import { cn } from "../utils"

// The three that came first, as a podium: each one's picture stands on a step, the first in the middle on the highest, the second at its left and the third at its right, and what put them there (a time, a share) is written under their step. Up to three
// entries, the first of the list being the first of the podium; fewer is fine, and a podium of one is the first alone. It draws what it is given: the page gives the pictures (a `CoverTile`, linked or not, with the name for a screen reader inside it) and the words under the steps, and puts a name
// on the list (`aria-label`). The steps are only for the eye: the number on each is hidden from a screen reader, which reads the list in the order of the places. A step is 2.5rem wide and may shrink where the podium has less room (beside a figure, in a narrow card).

type PodiumEntry = {
  /** Names the entry, which the list is keyed by. */
  name: string
  /** What stands on the step, as wide as the step (2.5rem): a picture the page draws. */
  picture: React.ReactNode
  /** What is written under the step: "1 h 05", "100%". */
  value: string
}

type PodiumProps = Omit<React.ComponentProps<"ol">, "children"> & {
  /** The three first, the best first. */
  entries: readonly PodiumEntry[]
}

/** The step and the place in the row of each of the three: the first is in the middle and the highest, the second at its left, the third at its right (the list stays in the order of the places). */
const PLACES = [
  { step: "h-6 bg-foreground/20", order: "order-2" },
  { step: "h-5 bg-foreground/10", order: "order-1" },
  { step: "h-4 bg-foreground/10", order: "order-3" },
] as const

function Podium({ entries, className, ...props }: PodiumProps) {
  return (
    <ol data-slot="podium" className={cn("flex items-end justify-center gap-1.5", className)} {...props}>
      {entries.slice(0, PLACES.length).map((entry, index) => {
        const place = PLACES[index]!
        return (
          <li key={entry.name} data-place={index + 1} className={cn("flex w-10 min-w-0 flex-col items-center gap-1", place.order)}>
            <div className="w-full">{entry.picture}</div>
            <span aria-hidden="true" className={cn("flex w-full items-start justify-center rounded-t-lg pt-0.5 font-heading text-xs tabular-nums", place.step)}>
              {index + 1}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{entry.value}</span>
          </li>
        )
      })}
    </ol>
  )
}

export { Podium }
export type { PodiumEntry, PodiumProps }
