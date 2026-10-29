"use client"

import * as React from "react"
import { cn } from "../utils"

// A scale of a few levels drawn as bars of the same height that you fill from the first bar up to a level by pressing that bar: the hub uses it for
// how complex a game is, from light to heavy. Each bar is a button, so the keyboard and a screen reader get what a pointer gets. The bars up to the
// pointer light up faintly before the press, so the fill can be seen coming.

type MeterProps = Omit<React.ComponentProps<"div">, "children" | "onChange"> & {
  /** How many bars the scale has. */
  levels?: number
  /** The level the bars are filled up to, null for none. */
  value: number | null
  /** Called with the level of the bar that is pressed, or with null when it is the level that is picked: pressing it again clears it. */
  onValueChange: (next: number | null) => void
  /** What a screen reader hears for the bar of a level ("Up to 3 of 5"), and what a pointer shows over it. */
  levelLabel: (level: number) => string
}

function Meter({ className, levels = 5, value, onValueChange, levelLabel, ...props }: MeterProps) {
  // The level under the pointer, for the faint fill that comes before the press. A touch has no hover, so only a mouse sets it.
  const [preview, setPreview] = React.useState<number | null>(null)
  return (
    <div data-slot="meter" className={cn("flex h-7 items-center", className)} onPointerLeave={() => setPreview(null)} {...props}>
      {Array.from({ length: levels }, (_, index) => {
        const level = index + 1
        const filled = value !== null && level <= value
        const previewed = !filled && preview !== null && level <= preview
        return (
          <button
            key={level}
            type="button"
            data-slot="meter-bar"
            aria-label={levelLabel(level)}
            aria-pressed={level === value}
            title={levelLabel(level)}
            onClick={() => onValueChange(level === value ? null : level)}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") setPreview(level)
            }}
            className="flex h-full w-3 items-center justify-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <span
              aria-hidden="true"
              className={cn("h-4 w-1.5 rounded-sm transition-colors", filled ? "bg-primary" : previewed ? "bg-primary/40" : "bg-muted")}
            />
          </button>
        )
      })}
    </div>
  )
}

export { Meter }
