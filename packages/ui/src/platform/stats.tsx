import * as React from "react"
import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"

// What the home says about the platform under its title, in two lines. `Stats` is the figures: how many players, how many games, each a number followed by what it counts ("12,480 players"), side by side
// and apart by a short line with rounded ends. `Perks` is what costs the visitor nothing, the way a shop says "free delivery": a few words each with a tick, in a row that wraps. Both are quiet (the number
// in the colour of the text, the rest in `muted-foreground`) and say their figures as text, so a screen reader reads "12,480 players" and not a picture of it. They draw what they are
// given and know where it comes from: the page gives the figures and the words.

type StatsProps = Omit<React.ComponentProps<"dl">, "children"> & {
  /** The figures, each as it is written (`12,480`) and what it counts (`players`), in the order they are read. */
  items: readonly { value: string; label: string }[]
}

/** A row of figures: the number big, what it counts after it on the same line, and between one figure and the next a short line, 2px wide, with rounded corners. */
function Stats({ items, className, ...props }: StatsProps) {
  return (
    <dl data-slot="stats" className={cn("flex items-center justify-center gap-6", className)} {...props}>
      {items.map((item) => (
        <div
          key={item.label}
          className="relative flex flex-row-reverse items-baseline gap-2 not-first:ps-6 not-first:before:absolute not-first:before:inset-s-0 not-first:before:top-1/2 not-first:before:h-5 not-first:before:w-0.5 not-first:before:-translate-y-1/2 not-first:before:rounded-xs not-first:before:bg-border"
        >
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="text-2xl text-foreground tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

type PerksProps = Omit<React.ComponentProps<"ul">, "children"> & {
  /** What costs nothing, in a few words each: `Free to play`, `No sign-up needed`. */
  items: readonly string[]
}

/** What costs the visitor nothing, a tick before each: in one row that wraps on a narrow screen. */
function Perks({ items, className, ...props }: PerksProps) {
  return (
    <ul data-slot="perks" className={cn("flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-muted-foreground", className)} {...props}>
      {items.map((item) => (
        <li key={item} className="flex items-center gap-1.5">
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} aria-hidden="true" className="size-4 text-foreground" />
          {item}
        </li>
      ))}
    </ul>
  )
}

export { Perks, Stats }
