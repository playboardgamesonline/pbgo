import * as React from "react"
import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "../utils"

// What the home says about the platform under its title, in two lines. `Stats` is the figures: how many players are connected, how many accounts are registered, how many games there are, each in a pill
// (a small container, `rounded-xl` like the other small containers of the platform, filled with the colour of the text at 10%: a faint white that lets the backdrop through, with no outline and no shadow, so that
// the number can roll up and down in it one day) that has a number followed by what it counts ("128 players online"). `Perks` is what costs the visitor nothing, the way
// a shop says "free delivery": a few words each with a tick, in a row that wraps. Both are quiet (the number in the colour of the text, what it counts in the colour of the text at 80% and the perks at 70%, white a little faded and not a grey) and say their figures as text, so a screen
// reader reads "128 players online" and not a picture of it. They draw what they are given and know where it comes from: the page gives the figures and the words.

type StatsProps = Omit<React.ComponentProps<"dl">, "children"> & {
  /** The figures, each as it is written (`12,480`) and what it counts (`players`), in the order they are read. */
  items: readonly { value: string; label: string }[]
}

/** A row of figures, each in its own pill: the number, a little big, and what it counts after it on the same line. The row goes on another line when the room runs out. */
function Stats({ items, className, ...props }: StatsProps) {
  return (
    <dl data-slot="stats" className={cn("flex flex-wrap items-center justify-center gap-2", className)} {...props}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-row-reverse items-baseline gap-2 rounded-xl bg-foreground/10 px-4 py-2">
          <dt className="text-sm text-foreground/80">{item.label}</dt>
          <dd className="text-lg text-foreground tabular-nums">{item.value}</dd>
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
    <ul data-slot="perks" className={cn("flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-foreground/70", className)} {...props}>
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
