import * as React from "react"
import { cn } from "../utils"

// The ones that came first, as a podium of bars: each one's picture stands on its bar, the first at the left and the others after it, and what put them there (a time, a share) is written inside its bar, in the middle of it. The bars are proportional: the first one's is the tallest and the others are as
// tall as their amount is of its amount, never lower than what holds their words. Up to three entries, the first of the list being the first of the podium; fewer is fine, and a podium of one is the first alone. It draws what it is given: the page gives the pictures (a `CoverTile`, linked or not, with the name
// for a screen reader inside it), the words in the bars and the amounts they are proportional to, and puts a name on the list (`aria-label`). A bar is 3rem wide and wider where its words need it.

type PodiumEntry = {
  /** Names the entry, which the list is keyed by. */
  name: string
  /** What stands on the bar, as wide as the bar (3rem, or more for its words): a picture the page draws. */
  picture: React.ReactNode
  /** What is written inside the bar: "1 h 05", "100%". */
  value: string
  /** What the height of the bar is proportional to, in any unit as long as the entries share it (seconds, a share): the tallest bar is the largest amount's. */
  amount: number
}

type PodiumProps = Omit<React.ComponentProps<"ol">, "children"> & {
  /** The three first, the best first: the first is at the left. */
  entries: readonly PodiumEntry[]
}

/** The fill of the bar of each place: the first is the strongest. */
const FILLS = ["bg-foreground/20", "bg-foreground/10", "bg-foreground/10"] as const

/** The height of the tallest bar and the least a bar has, in rem (3rem is `h-12` and 1.25rem `h-5`): what is in between is proportional to the amount, and the least keeps the words of a bar that is much lower than the first. */
const BAR_MAX = 3
const BAR_MIN = 1.25

/** How tall the bar of an entry is, in rem, of the largest amount of the podium. */
export function barHeight(amount: number, largest: number): number {
  if (!(largest > 0) || !(amount > 0)) return BAR_MIN
  return Math.min(BAR_MAX, Math.max(BAR_MIN, (amount / largest) * BAR_MAX))
}

function Podium({ entries, className, ...props }: PodiumProps) {
  const shown = entries.slice(0, FILLS.length)
  const largest = Math.max(0, ...shown.map((entry) => entry.amount))
  return (
    <ol data-slot="podium" className={cn("flex items-end justify-center gap-1.5", className)} {...props}>
      {shown.map((entry, index) => (
        <li key={entry.name} data-place={index + 1} className="flex w-12 min-w-fit flex-col items-center gap-1">
          <div className="w-full">{entry.picture}</div>
          <span
            data-slot="podium-bar"
            style={{ height: `${barHeight(entry.amount, largest)}rem` }}
            className={cn("flex w-full items-center justify-center rounded-t-lg px-1 font-heading text-xs whitespace-nowrap tabular-nums", FILLS[index])}
          >
            {entry.value}
          </span>
        </li>
      ))}
    </ol>
  )
}

export { Podium }
export type { PodiumEntry, PodiumProps }
