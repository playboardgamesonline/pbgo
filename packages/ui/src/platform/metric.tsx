import * as React from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { cn } from "../utils"

// A figure with its name over it, for what is counted at a glance in a card (the games played and the win rate under a rank): the name small and quiet (0.75rem), the figure in the heading font (1rem), in tabular figures so that it does not shift as it changes. A picto can stand at the left of both, quiet too
// and as tall as the two lines. No box: it stands on whatever it is put on, and a row of them is spaced as the page wants (`gap-*` on the list). It is a `div` of a description list, the name its `dt` and the figure its `dd`, so a row of them is a `<dl>`.

type MetricProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** What the figure counts ("Games played"): written as it is read, in sentence case. */
  label: string
  /** The figure, written ("24", "58%"). */
  value: React.ReactNode
  /** A picto at the left of the name and the figure. */
  icon?: IconSvgElement
}

function Metric({ label, value, icon, className, ...props }: MetricProps) {
  return (
    <div data-slot="metric" className={cn("grid items-center gap-x-2 gap-y-0.5", icon ? "grid-cols-[auto_1fr]" : "grid-cols-1", className)} {...props}>
      {icon && <HugeiconsIcon icon={icon} strokeWidth={1.5} aria-hidden="true" className="row-span-2 size-5 shrink-0 text-muted-foreground" />}
      <dt className="text-xs leading-4 text-muted-foreground">{label}</dt>
      <dd className="font-heading text-base leading-5 tabular-nums">{value}</dd>
    </div>
  )
}

export { Metric }
export type { MetricProps }
