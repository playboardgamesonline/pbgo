import * as React from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { cn } from "../utils"

// A figure with its name over it, for what is counted at a glance: the players online and the queue time in the head of a page (`md`: the name at 0.875rem, the figure in the heading font at 1.25rem) and the games played, the win rate and the play time in a card (`sm`: 0.75rem and
// 1rem). The name is small and quiet, the figure in tabular figures so that it does not shift as it changes. A picto can stand at the left of both, quiet too and as tall as the two lines. No box: it stands on whatever it is put on, and a row of them is spaced as the page wants (`gap-*` on the list). It is a `div` of a description
// list, the name its `dt` and the figure its `dd`, so a row of them is a `<dl>`.

type MetricProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** What the figure counts ("Players online"): written as it is read, in sentence case. */
  label: string
  /** The figure, written ("184,363", "~0:40"). */
  value: React.ReactNode
  /** A picto at the left of the name and the figure. */
  icon?: IconSvgElement
  size?: "sm" | "md"
}

function Metric({ label, value, icon, size = "md", className, ...props }: MetricProps) {
  const small = size === "sm"
  return (
    <div data-slot="metric" data-size={size} className={cn("grid items-center gap-x-2", icon ? "grid-cols-[auto_1fr]" : "grid-cols-1", small ? "gap-y-0.5" : "gap-y-1", className)} {...props}>
      {icon && <HugeiconsIcon icon={icon} strokeWidth={1.5} aria-hidden="true" className={cn("row-span-2 shrink-0 text-muted-foreground", small ? "size-5" : "size-6")} />}
      <dt className={cn("text-muted-foreground", small ? "text-xs leading-4" : "text-sm")}>{label}</dt>
      <dd className={cn("font-heading tabular-nums", small ? "text-base leading-5" : "text-xl leading-7")}>{value}</dd>
    </div>
  )
}

export { Metric }
export type { MetricProps }
